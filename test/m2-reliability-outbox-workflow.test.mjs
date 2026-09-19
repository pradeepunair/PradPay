import assert from "node:assert/strict";
import test from "node:test";

import {
  computeBackoffMs,
  dispatchOutboxBatch,
} from "../lib/outbox/dispatcher.mjs";
import { commitConsequentialAction } from "../lib/outbox/transactional-enqueue.mjs";
import { DeterministicWorkflowRunner } from "../lib/workflows/deterministic-runner.mjs";

function createOutboxPersistence(seed) {
  const jobs = new Map(seed.map((job) => [job.id, structuredClone(job)]));
  return {
    jobs,
    async leaseOutboxJobs({ owner, now, limit, leaseMs }) {
      const leased = [];
      for (const job of jobs.values()) {
        if (leased.length >= limit) break;
        const eligible = job.status === "pending"
          || (job.status === "leased" && job.leaseExpiresAt <= now)
          || (job.status === "retry" && job.nextAttemptAt <= now);
        if (!eligible) continue;
        job.status = "leased";
        job.leaseOwner = owner;
        job.leaseToken = `fence_${job.fence + 1}`;
        job.fence += 1;
        job.leaseExpiresAt = now + leaseMs;
        leased.push(structuredClone(job));
      }
      return leased;
    },
    async ackOutboxJob({ jobId, owner, leaseToken }) {
      const job = jobs.get(jobId);
      if (job.status !== "leased" || job.leaseOwner !== owner || job.leaseToken !== leaseToken) {
        return { status: "stale_fence" };
      }
      job.status = "completed";
      return { status: "acked" };
    },
    async failOutboxJob({ jobId, owner, leaseToken, terminal, nextAttemptAt, errorCode }) {
      const job = jobs.get(jobId);
      if (job.status !== "leased" || job.leaseOwner !== owner || job.leaseToken !== leaseToken) {
        return { status: "stale_fence" };
      }
      job.attempts += 1;
      job.status = terminal ? "failed" : "retry";
      job.nextAttemptAt = nextAttemptAt;
      job.lastErrorCode = errorCode;
      return { status: terminal ? "terminal" : "retry_scheduled" };
    },
  };
}

function seedJob(overrides = {}) {
  return {
    id: "job_01",
    type: "workflow.start",
    dedupeKey: "run:run_01:start",
    safePayload: { runId: "run_01" },
    status: "pending",
    attempts: 0,
    fence: 0,
    leaseExpiresAt: 0,
    nextAttemptAt: 0,
    ...overrides,
  };
}

test("business mutation, domain event, and outbox job commit atomically", async () => {
  const state = { business: [], events: [], jobs: [] };
  const persistence = {
    async withTransaction(work) {
      const pending = structuredClone(state);
      const result = await work(pending);
      Object.assign(state, pending);
      return result;
    },
    async appendDomainEvent(tx, event) {
      tx.events.push(event);
      return { sequence: tx.events.length, ...event };
    },
    async createOutboxJob(tx, job) {
      tx.jobs.push(job);
      return { status: "created", job };
    },
  };
  await commitConsequentialAction({
    persistence,
    mutate: async (tx) => tx.business.push({ runId: "run_01", status: "waiting" }),
    event: {
      eventId: "event_01",
      runId: "run_01",
      sessionId: "session_01",
      type: "workflow.requested",
      schemaVersion: 1,
      safePayload: {},
    },
    outboxJob: {
      type: "workflow.start",
      dedupeKey: "run:run_01:start",
      sessionId: "session_01",
      runId: "run_01",
      safePayload: { runId: "run_01" },
    },
  });
  assert.deepEqual(state.business, [{ runId: "run_01", status: "waiting" }]);
  assert.equal(state.events.length, 1);
  assert.equal(state.jobs.length, 1);
});

test("outbox write failure rolls back the business mutation and event", async () => {
  const state = { business: [], events: [], jobs: [] };
  const persistence = {
    async withTransaction(work) {
      const pending = structuredClone(state);
      const result = await work(pending);
      Object.assign(state, pending);
      return result;
    },
    async appendDomainEvent(tx, event) {
      tx.events.push(event);
      return event;
    },
    async createOutboxJob() {
      throw new Error("synthetic outbox failure");
    },
  };
  await assert.rejects(commitConsequentialAction({
    persistence,
    mutate: async (tx) => tx.business.push({ runId: "run_01" }),
    event: {
      eventId: "event_01",
      runId: "run_01",
      sessionId: "session_01",
      type: "workflow.requested",
    },
    outboxJob: {
      type: "workflow.start",
      dedupeKey: "run:run_01:start",
      sessionId: "session_01",
      runId: "run_01",
    },
  }), /synthetic outbox failure/);
  assert.deepEqual(state, { business: [], events: [], jobs: [] });
});

test("duplicate outbox admission does not repeat mutation or event", async () => {
  const state = { business: [], events: [], jobs: new Map() };
  const persistence = {
    async withTransaction(work) { return work(state); },
    async appendDomainEvent(tx, event) {
      tx.events.push(event);
      return event;
    },
    async createOutboxJob(tx, job) {
      if (tx.jobs.has(job.dedupeKey)) return { status: "duplicate", job: tx.jobs.get(job.dedupeKey) };
      tx.jobs.set(job.dedupeKey, job);
      return { status: "created", job };
    },
  };
  const input = {
    persistence,
    mutate: async (tx) => tx.business.push("effect"),
    event: {
      eventId: "event_01",
      runId: "run_01",
      sessionId: "session_01",
      type: "workflow.requested",
    },
    outboxJob: {
      type: "workflow.start",
      dedupeKey: "run:run_01:start",
      sessionId: "session_01",
      runId: "run_01",
    },
  };
  assert.equal((await commitConsequentialAction(input)).disposition, "created");
  assert.equal((await commitConsequentialAction(input)).disposition, "duplicate");
  assert.deepEqual(state.business, ["effect"]);
  assert.equal(state.events.length, 1);
  assert.equal(state.jobs.size, 1);
});

test("transactional outbox rejects missing or mismatched ownership scope", async () => {
  const persistence = {
    withTransaction: async (work) => work({}),
    appendDomainEvent: async () => ({}),
    createOutboxJob: async () => ({ status: "created" }),
  };
  const base = {
    persistence,
    mutate: async () => ({}),
    event: { eventId: "event_01", runId: "run_01", sessionId: "session_01", type: "test" },
  };
  await assert.rejects(
    commitConsequentialAction({
      ...base,
      outboxJob: { type: "test", dedupeKey: "test:01" },
    }),
    /scoped outbox job/i,
  );
  await assert.rejects(
    commitConsequentialAction({
      ...base,
      outboxJob: {
        type: "test",
        dedupeKey: "test:01",
        sessionId: "session_02",
        runId: "run_01",
      },
    }),
    /scope must match/i,
  );
});

test("bounded exponential retry backoff is deterministic", () => {
  assert.equal(computeBackoffMs({ attempt: 1, baseDelayMs: 100, maxDelayMs: 1_000 }), 100);
  assert.equal(computeBackoffMs({ attempt: 2, baseDelayMs: 100, maxDelayMs: 1_000 }), 200);
  assert.equal(computeBackoffMs({ attempt: 99, baseDelayMs: 100, maxDelayMs: 1_000 }), 1_000);
});

test("commit-before-ack crash recovers with exactly one business effect", async () => {
  const persistence = createOutboxPersistence([seedJob()]);
  const applied = new Set();
  let firstDelivery = true;
  const deliver = async (job) => {
    const alreadyApplied = applied.has(job.dedupeKey);
    if (!alreadyApplied) applied.add(job.dedupeKey);
    if (firstDelivery) {
      firstDelivery = false;
      throw Object.assign(new Error("synthetic ack loss"), { retryable: true, code: "ACK_LOST" });
    }
    return { duplicate: alreadyApplied };
  };

  const first = await dispatchOutboxBatch({
    persistence,
    owner: "worker_a",
    now: 1_000,
    deliver,
    leaseMs: 50,
    maxAttempts: 3,
    baseDelayMs: 10,
  });
  assert.equal(first.retryScheduled, 1);
  assert.equal(applied.size, 1);

  const second = await dispatchOutboxBatch({
    persistence,
    owner: "worker_b",
    now: 1_020,
    deliver,
    leaseMs: 50,
    maxAttempts: 3,
    baseDelayMs: 10,
  });
  assert.equal(second.acked, 1);
  assert.equal(applied.size, 1);
  assert.equal(persistence.jobs.get("job_01").status, "completed");
});

test("dispatcher preserves ownership scope at the consumer boundary", async () => {
  const persistence = createOutboxPersistence([seedJob({
    sessionId: "session_01",
    runId: "run_01",
  })]);
  let delivered;
  await dispatchOutboxBatch({
    persistence,
    owner: "worker_a",
    now: 1_000,
    deliver: async (job) => { delivered = job; },
  });
  assert.equal(delivered.sessionId, "session_01");
  assert.equal(delivered.runId, "run_01");
});

test("lease fencing prevents an expired worker from acknowledging", async () => {
  const persistence = createOutboxPersistence([seedJob()]);
  const [oldLease] = await persistence.leaseOutboxJobs({ owner: "worker_old", now: 100, limit: 1, leaseMs: 10 });
  const [newLease] = await persistence.leaseOutboxJobs({ owner: "worker_new", now: 111, limit: 1, leaseMs: 10 });
  const staleAck = await persistence.ackOutboxJob({
    jobId: oldLease.id,
    owner: oldLease.leaseOwner,
    leaseToken: oldLease.leaseToken,
  });
  assert.equal(staleAck.status, "stale_fence");
  const currentAck = await persistence.ackOutboxJob({
    jobId: newLease.id,
    owner: newLease.leaseOwner,
    leaseToken: newLease.leaseToken,
  });
  assert.equal(currentAck.status, "acked");
});

test("duplicate workers do not concurrently dispatch an active lease", async () => {
  const persistence = createOutboxPersistence([seedJob()]);
  const first = await persistence.leaseOutboxJobs({ owner: "worker_a", now: 100, limit: 1, leaseMs: 100 });
  const second = await persistence.leaseOutboxJobs({ owner: "worker_b", now: 100, limit: 1, leaseMs: 100 });
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
});

test("dispatcher marks bounded final failure terminal and emits safe telemetry", async () => {
  const persistence = createOutboxPersistence([seedJob({ attempts: 2 })]);
  const observations = [];
  const result = await dispatchOutboxBatch({
    persistence,
    owner: "worker_a",
    now: 1_000,
    leaseMs: 50,
    maxAttempts: 3,
    baseDelayMs: 10,
    observe: (entry) => observations.push(entry),
    deliver: async () => {
      throw Object.assign(new Error("sensitive provider detail must not be logged"), {
        retryable: true,
        code: "DELIVERY_FAILED",
      });
    },
  });
  assert.equal(result.terminalFailures, 1);
  assert.equal(persistence.jobs.get("job_01").status, "failed");
  assert.equal(JSON.stringify(observations).includes("sensitive provider detail"), false);
  assert.equal(JSON.stringify(observations).includes("run:run_01:start"), false);
  assert.match(observations.at(-1).dedupeKeyHash, /^[a-f0-9]{64}$/);
  assert.equal(observations.at(-1).event, "outbox.delivery_terminal");
  assert.equal(observations.at(-1).errorCode, "DELIVERY_FAILED");
});

test("observer failure cannot interrupt or misclassify delivery", async () => {
  const persistence = createOutboxPersistence([seedJob()]);
  const result = await dispatchOutboxBatch({
    persistence,
    owner: "worker_a",
    now: 1_000,
    observe: () => { throw new Error("synthetic monitoring outage"); },
    deliver: async () => {},
  });
  assert.equal(result.acked, 1);
  assert.equal(result.retryScheduled, 0);
  assert.equal(result.terminalFailures, 0);
  assert.equal(persistence.jobs.get("job_01").status, "completed");
});

test("dispatcher rejects an unconfirmed failure transition", async () => {
  const persistence = createOutboxPersistence([seedJob()]);
  persistence.failOutboxJob = async () => undefined;
  await assert.rejects(
    dispatchOutboxBatch({
      persistence,
      owner: "worker_a",
      now: 1_000,
      deliver: async () => { throw new Error("synthetic failure"); },
    }),
    /invalid failure disposition/i,
  );
});

test("deterministic workflow fake covers wait, callback wake, retry, resume, cancel, and status", () => {
  const runner = new DeterministicWorkflowRunner({ now: () => 1_000 });
  const started = runner.start({
    workflowId: "workflow_01",
    runId: "run_01",
    definition: "checkout",
    definitionVersion: "m2-local-v1",
    input: { safe: true },
  });
  assert.equal(started.status, "running");

  const waiting = runner.waitOrHook("workflow_01", {
    kind: "hook",
    hook: "approval:run_01",
  });
  assert.equal(waiting.status, "waiting");
  assert.equal(runner.status("workflow_01").wait.kind, "hook");

  const woken = runner.wakeCallback("workflow_01", {
    hook: "approval:run_01",
    callbackId: "callback_01",
    payload: { approved: true },
  });
  assert.equal(woken.status, "running");
  assert.equal(runner.wakeCallback("workflow_01", {
    hook: "approval:run_01",
    callbackId: "callback_01",
    payload: { approved: true },
  }).disposition, "duplicate");

  runner.fail("workflow_01", { code: "TRANSIENT_STEP", retryable: true });
  const retry = runner.retry("workflow_01");
  assert.equal(retry.attempt, 2);
  runner.waitOrHook("workflow_01", { kind: "wait", token: "operator_release" });
  assert.equal(runner.resume("workflow_01", { token: "operator_release" }).status, "running");
  assert.equal(runner.cancel("workflow_01", { reasonCode: "OPERATOR_CANCEL" }).status, "canceled");
  assert.equal(runner.status("workflow_01").status, "canceled");
  assert.throws(() => runner.resume("workflow_01", { token: "operator_release" }), /terminal/i);
});

test("workflow fake has no timers, background process, or provider dependency", () => {
  const runner = new DeterministicWorkflowRunner();
  assert.deepEqual(runner.capabilities(), {
    mode: "deterministic_local_fake",
    durable: false,
    automaticTimers: false,
    backgroundExecution: false,
    externalCalls: false,
  });
});

test("workflow start replays identical input but rejects identifier collisions", () => {
  const runner = new DeterministicWorkflowRunner({ now: () => 1_000 });
  const start = {
    workflowId: "workflow_01",
    runId: "run_01",
    definition: "checkout",
    definitionVersion: "m2-local-v1",
    input: { safe: true },
  };
  runner.start(start);
  assert.equal(runner.start(structuredClone(start)).disposition, "replay");
  assert.throws(
    () => runner.start({ ...start, runId: "run_02" }),
    /different workflow parameters/i,
  );
  assert.throws(
    () => runner.start({ ...start, definitionVersion: "m2-local-v2" }),
    /different workflow parameters/i,
  );
  assert.throws(
    () => runner.start({ ...start, input: { safe: false } }),
    /different workflow parameters/i,
  );
});
