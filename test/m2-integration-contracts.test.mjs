import assert from "node:assert/strict";
import test from "node:test";

import { createReliabilityPersistenceAdapter } from "../lib/persistence/reliability-adapter.mjs";
import { claimOperation } from "../lib/payments/idempotent-operations.mjs";
import { createStripeWebhookReceiptService } from "../lib/payments/stripe-webhook-receipts.mjs";
import { scheduleUnknownOutcomeReconciliation } from "../lib/reconciliation/unknown-outcomes.mjs";
import { commitConsequentialAction } from "../lib/outbox/transactional-enqueue.mjs";
import { dispatchOutboxBatch } from "../lib/outbox/dispatcher.mjs";

function lowLevelPersistence() {
  const calls = [];
  const jobs = [];
  return {
    calls,
    jobs,
    async withTransaction(work) {
      calls.push(["withTransaction"]);
      return work({ query: async () => ({ rows: [] }) });
    },
    async appendDomainEvent(_tx, event) {
      calls.push(["appendDomainEvent", event]);
      return { ...event, sequence: 1 };
    },
    async claimIdempotency(_tx, claim) {
      calls.push(["claimIdempotency", claim]);
      return "created";
    },
    async recordWebhookReceipt(_tx, receipt) {
      calls.push(["recordWebhookReceipt", receipt]);
      return "created";
    },
    async createOutboxJob(_tx, job) {
      calls.push(["createOutboxJob", job]);
      jobs.push(job);
      return { outcome: "created", job: {
        id: job.id,
        kind: job.kind,
        dedupe_key: job.dedupeKey,
        session_id: job.sessionId,
        run_id: job.runId,
        safe_payload: job.safePayload,
        attempt_count: 0,
      } };
    },
    async leaseOutboxJobs(_tx, options) {
      calls.push(["leaseOutboxJobs", options]);
      return [{
        id: "outbox_leased",
        kind: "workflow.start",
        dedupe_key: "run:run_000001:start",
        session_id: "sess_000001",
        run_id: "run_000001",
        safe_payload: { runId: "run_000001" },
        attempt_count: 0,
        lease_owner: options.owner,
        lease_token: "fence_1",
      }];
    },
    async ackOutboxJob(_tx, options) {
      calls.push(["ackOutboxJob", options]);
      return true;
    },
    async failOutboxJob(_tx, options) {
      calls.push(["failOutboxJob", options]);
      return { state: options.terminal ? "dead" : "pending" };
    },
  };
}

function createAdapter(low) {
  let sequence = 0;
  return createReliabilityPersistenceAdapter(low, {
    createId: (prefix) => `${prefix}_${++sequence}`,
  });
}

test("data persistence and reliability idempotency contracts compose", async () => {
  const low = lowLevelPersistence();
  const persistence = createAdapter(low);
  const result = await claimOperation({
    persistence,
    claim: {
      sessionId: "sess_000001",
      scope: "checkout.create",
      key: "key_1",
      requestHash: "a".repeat(64),
    },
    createOperation: async (_tx, { idempotency }) => ({ operationId: `op_${idempotency.key}` }),
    readOperation: async () => null,
  });
  assert.equal(result.disposition, "created");
  assert.equal(result.operation.operationId, "op_key_1");
});

test("verified webhook receipt is translated to the safe durable data contract before business application", async () => {
  const low = lowLevelPersistence();
  const persistence = createAdapter(low);
  let applied;
  const service = createStripeWebhookReceiptService({
    persistence,
    verifyEvent: () => ({
      id: "evt_000001",
      type: "payment_intent.succeeded",
      created: 1_700_000_000,
      livemode: false,
      data: { object: { id: "pi_000001" } },
    }),
    now: () => 1_700_000_001_000,
    applyBusinessEvent: async (_tx, event) => { applied = event; return { disposition: "applied" }; },
  });
  const result = await service.receive({ rawBody: "{}", signature: "test", endpointSecret: "test" });
  assert.equal(result.disposition, "applied");
  const stored = low.calls.find(([method]) => method === "recordWebhookReceipt")[1];
  assert.deepEqual({
    id: stored.id,
    provider: stored.provider,
    providerEventId: stored.providerEventId,
    eventType: stored.eventType,
  }, {
    id: "webhook_1",
    provider: "stripe",
    providerEventId: "evt_000001",
    eventType: "payment_intent.succeeded",
  });
  assert.match(stored.safePayload.payloadSha256, /^[a-f0-9]{64}$/);
  assert.equal("rawBody" in stored.safePayload, false);
  assert.equal(applied.objectId, "pi_000001");
});

test("event and reliability outbox contracts compose atomically and preserve ownership", async () => {
  const low = lowLevelPersistence();
  const persistence = createAdapter(low);
  const result = await commitConsequentialAction({
    persistence,
    mutate: async () => ({ state: "waiting" }),
    event: {
      eventId: "event_000001",
      runId: "run_000001",
      sessionId: "sess_000001",
      type: "workflow.requested",
      schemaVersion: "1.0.0",
      safePayload: {},
    },
    outboxJob: {
      type: "workflow.start",
      dedupeKey: "run:run_000001:start",
      sessionId: "sess_000001",
      runId: "run_000001",
      safePayload: { runId: "run_000001" },
    },
  });
  assert.equal(result.disposition, "created");
  const stored = low.jobs[0];
  assert.equal(stored.id, "outbox_1");
  assert.equal(stored.kind, "workflow.start");
  assert.equal(stored.sessionId, "sess_000001");
  assert.equal(stored.runId, "run_000001");
});

test("unknown-outcome reconciliation receives a durable generated outbox identity", async () => {
  const low = lowLevelPersistence();
  const persistence = createAdapter(low);
  const result = await scheduleUnknownOutcomeReconciliation({
    persistence,
    operation: {
      status: "unknown",
      operationId: "operation_1",
      attemptId: "attempt_1",
      sessionId: "sess_000001",
      runId: "run_000001",
    },
  });
  assert.equal(result.status, "created");
  assert.equal(low.jobs[0].id, "outbox_1");
  assert.equal(low.jobs[0].kind, "payment.reconcile_unknown");
});

test("dispatcher contract maps data leases and fenced acknowledgement", async () => {
  const low = lowLevelPersistence();
  const persistence = createAdapter(low);
  let delivered;
  const result = await dispatchOutboxBatch({
    persistence,
    owner: "worker_1",
    now: 1_700_000_000_000,
    deliver: async (job) => { delivered = job; },
  });
  assert.deepEqual(result, {
    leased: 1,
    acked: 1,
    retryScheduled: 0,
    terminalFailures: 0,
    staleFences: 0,
  });
  assert.equal(delivered.type, "workflow.start");
  assert.equal(delivered.sessionId, "sess_000001");
  assert.deepEqual(low.calls.find(([method]) => method === "ackOutboxJob")[1], {
    id: "outbox_leased",
    owner: "worker_1",
    token: "fence_1",
  });
});

test("non-retryable delivery maps to a terminal fenced data transition", async () => {
  const low = lowLevelPersistence();
  const persistence = createAdapter(low);
  const result = await dispatchOutboxBatch({
    persistence,
    owner: "worker_1",
    now: 1_700_000_000_000,
    deliver: async () => { throw Object.assign(new Error("safe synthetic failure"), { retryable: false, code: "TERMINAL" }); },
  });
  assert.equal(result.terminalFailures, 1);
  const failed = low.calls.find(([method]) => method === "failOutboxJob")[1];
  assert.equal(failed.terminal, true);
  assert.equal(failed.id, "outbox_leased");
  assert.equal(failed.token, "fence_1");
});
