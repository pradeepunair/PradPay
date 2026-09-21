import assert from "node:assert/strict";
import test from "node:test";

import { createLocalSafetyController } from "../lib/safety/local-controller.mjs";
import { createLocalSafetyPersistence } from "../lib/safety/persistence.mjs";
import {
  createSyntheticPaymentProvider,
  reduceSyntheticPaymentEvent,
  SyntheticIdempotencyConflictError,
  SyntheticProviderTimeoutError,
} from "../lib/payments/synthetic-provider.mjs";

const baseClaim = Object.freeze({
  environment: "local",
  admissionId: "admission_m3",
  policyId: "policy_m3",
  sessionId: "session_m3",
  runId: "run_m3",
  operationId: "operation_m3",
  attemptId: "attempt_m3",
  idempotencyKey: "idempotency_m3",
  requestHash: "a".repeat(64),
  amountMinor: 1250,
});

function createSafetyPersistence({
  enabled = true,
  reserveStatus = "reserved",
  failRead = false,
  failReserve = false,
  failOutbox = false,
} = {}) {
  const reservations = new Map();
  const outbox = new Map();
  const attempts = new Map([[`${baseClaim.sessionId}:${baseClaim.runId}:${baseClaim.attemptId}`, {
    id: baseClaim.attemptId,
    session_id: baseClaim.sessionId,
    run_id: baseClaim.runId,
    operation_key: baseClaim.operationId,
    request_hash: baseClaim.requestHash,
    state: "submitted",
  }]]);
  const reconciliation = new Map();
  const calls = { read: 0, reserve: 0, attemptClaim: 0, reconciliationRead: 0 };
  return {
    calls,
    reservations,
    outbox,
    attempts,
    reconciliation,
    async withTransaction(work) {
      const snapshots = {
        reservations: new Map(reservations),
        outbox: new Map(outbox),
        attempts: new Map([...attempts].map(([key, value]) => [key, { ...value }])),
        reconciliation: new Map(reconciliation),
      };
      try {
        return await work({ reservations, outbox, attempts, reconciliation });
      } catch (error) {
        reservations.clear();
        outbox.clear();
        attempts.clear();
        reconciliation.clear();
        for (const [key, value] of snapshots.reservations) reservations.set(key, value);
        for (const [key, value] of snapshots.outbox) outbox.set(key, value);
        for (const [key, value] of snapshots.attempts) attempts.set(key, value);
        for (const [key, value] of snapshots.reconciliation) reconciliation.set(key, value);
        throw error;
      }
    },
    async readSafetyControl(_tx, { environment }) {
      calls.read += 1;
      if (failRead) throw new Error("sensitive database detail");
      if (environment !== "local") return null;
      return enabled
        ? { paymentAdmissionEnabled: true, version: 1, reasonCode: "LOCAL_SYNTHETIC_ENABLED" }
        : { paymentAdmissionEnabled: false, version: 2, reasonCode: "OPERATOR_KILL" };
    },
    async reserveSyntheticBudget(tx, claim) {
      calls.reserve += 1;
      if (failReserve) throw new Error("sensitive reservation detail");
      const key = `${claim.environment}:${claim.operationKey}:${claim.attemptId}`;
      const existing = tx.reservations.get(key);
      if (existing) {
        if (existing.requestHash !== claim.requestHash || existing.amountMinor !== claim.amountMinor
          || existing.policyId !== claim.policyId) {
          return { status: "conflict", record: existing };
        }
        return {
          status: existing.decision === "reserved" ? "replay" : existing.decision,
          record: existing,
        };
      }
      const decision = enabled ? reserveStatus : "kill_switch";
      const record = Object.freeze({ ...claim, decision, reservationId: "reservation_m3" });
      tx.reservations.set(key, record);
      return { status: decision, record };
    },
    async claimSyntheticPaymentAttempt(tx, scope) {
      calls.attemptClaim += 1;
      const attempt = tx.attempts.get(`${scope.sessionId}:${scope.runId}:${scope.attemptId}`);
      if (!attempt || attempt.state !== "submitted"
        || attempt.operation_key !== scope.operationId
        || attempt.request_hash !== scope.requestHash) {
        return { status: "rejected" };
      }
      return { status: "ready", attempt: {
        sessionId: scope.sessionId,
        runId: scope.runId,
        attemptId: scope.attemptId,
        operationId: scope.operationId,
        requestHash: scope.requestHash,
        state: "submitted",
      } };
    },
    async markPaymentAttemptUnknown(tx, scope) {
      const key = `${scope.sessionId}:${scope.runId}:${scope.attemptId}`;
      const attempt = tx.attempts.get(key);
      if (!attempt || attempt.operation_key !== scope.operationId) return { status: "rejected" };
      if (!["submitted", "processing", "unknown"].includes(attempt.state)) return { status: "rejected" };
      const record = { ...attempt, state: "unknown" };
      tx.attempts.set(key, record);
      return { status: "updated", attempt: record };
    },
    async readUnknownPaymentAttempt(tx, scope) {
      const attempt = tx.attempts.get(`${scope.sessionId}:${scope.runId}:${scope.attemptId}`);
      return attempt?.state === "unknown" ? attempt : null;
    },
    async upsertReconciliationControl(tx, control) {
      const key = `${control.sessionId}:${control.runId}:${control.attemptId}`;
      if (!tx.attempts.has(key)) throw new Error("durable attempt foreign key rejected");
      const existing = tx.reconciliation.get(key);
      const record = existing ?? Object.freeze({
        id: control.id,
        session_id: control.sessionId,
        run_id: control.runId,
        attempt_id: control.attemptId,
        state: "pending",
      });
      tx.reconciliation.set(key, record);
      return record;
    },
    async readReconciliationControl(tx, scope) {
      calls.reconciliationRead += 1;
      return tx.reconciliation.get(`${scope.sessionId}:${scope.runId}:${scope.attemptId}`) ?? null;
    },
    async createOutboxJob(tx, job) {
      if (failOutbox) throw new Error("synthetic outbox write failure");
      if (tx.outbox.has(job.dedupeKey)) return { status: "duplicate", job: tx.outbox.get(job.dedupeKey) };
      tx.outbox.set(job.dedupeKey, job);
      return { status: "created", job };
    },
  };
}

function identity(overrides = {}) {
  return {
    operationId: baseClaim.operationId,
    attemptId: baseClaim.attemptId,
    idempotencyKey: baseClaim.idempotencyKey,
    requestHash: baseClaim.requestHash,
    ...overrides,
  };
}

test("safety persistence facade composes Dax data ports with reliability outbox shape", async () => {
  const tx = Object.freeze({ name: "transaction" });
  let reservedClaim;
  let outboxJob;
  const dataPersistence = {
    async withTransaction(work) { return work(tx); },
    async readSafetyControl(receivedTx) {
      assert.equal(receivedTx, tx);
      return { paymentAdmissionEnabled: true, version: 1, reasonCode: "local_test" };
    },
    async reserveSyntheticBudget(receivedTx, claim) {
      assert.equal(receivedTx, tx);
      reservedClaim = claim;
      return { status: "reserved", record: { id: claim.id } };
    },
    async claimSyntheticPaymentAttempt(receivedTx, scope) {
      assert.equal(receivedTx, tx);
      return { status: "ready", attempt: { sessionId: scope.sessionId, runId: scope.runId, attemptId: scope.attemptId, operationId: scope.operationId, requestHash: scope.requestHash, state: "submitted" } };
    },
    async markPaymentAttemptUnknown(receivedTx, scope) {
      assert.equal(receivedTx, tx);
      return { ...scope, state: "unknown" };
    },
    async readUnknownPaymentAttempt(receivedTx, scope) {
      assert.equal(receivedTx, tx);
      return { ...scope, state: "unknown" };
    },
    async upsertReconciliationControl() {},
    async readReconciliationControl() {},
    async createOutboxJob(receivedTx, job) {
      assert.equal(receivedTx, tx);
      outboxJob = job;
      return { status: "created", job };
    },
  };
  const outboxPersistence = {
    async createOutboxJob(receivedTx, job) {
      assert.equal(receivedTx, tx);
      outboxJob = job;
      return { status: "created", job };
    },
  };
  const persistence = createLocalSafetyPersistence({ dataPersistence, outboxPersistence });
  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "reserved");
  assert.deepEqual(reservedClaim, {
    id: baseClaim.admissionId,
    environment: baseClaim.environment,
    policyId: baseClaim.policyId,
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    operationKey: baseClaim.operationId,
    attemptId: baseClaim.attemptId,
    requestHash: baseClaim.requestHash,
    amountMinor: baseClaim.amountMinor,
  });
  const scope = {
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: baseClaim.attemptId,
  };
  assert.deepEqual(await persistence.claimSyntheticPaymentAttempt(tx, {
    ...scope,
    operationId: baseClaim.operationId,
    requestHash: baseClaim.requestHash,
  }), {
    status: "ready",
    attempt: {
      ...scope,
      operationId: baseClaim.operationId,
      requestHash: baseClaim.requestHash,
      state: "submitted",
    },
  });
  assert.deepEqual(await persistence.markPaymentAttemptUnknown(tx, {
    ...scope,
    operationId: baseClaim.operationId,
  }), { ...scope, operationId: baseClaim.operationId, state: "unknown" });
  assert.deepEqual(await persistence.readUnknownPaymentAttempt(tx, scope), {
    ...scope,
    state: "unknown",
  });
  await persistence.createOutboxJob(tx, { type: "payment.reconcile_unknown", dedupeKey: "reconcile:attempt_m3" });
  assert.deepEqual(outboxJob, { type: "payment.reconcile_unknown", dedupeKey: "reconcile:attempt_m3" });
});

for (const [scenario, expectedStatus] of [
  ["succeeded", "succeeded"],
  ["declined", "declined"],
  ["requires_action", "requires_action"],
]) {
  test(`synthetic ${scenario} scenario is deterministic and replays one effect`, async () => {
    const provider = createSyntheticPaymentProvider({ scenario });
    const first = await provider.execute(identity());
    const replay = await provider.execute(identity());
    assert.equal(first.status, expectedStatus);
    assert.equal(first.replay, false);
    assert.equal(replay.replay, true);
    assert.equal(replay.effectId, first.effectId);
    assert.deepEqual(replay.safeEvent, first.safeEvent);
    assert.deepEqual(provider.inspect(), { calls: 2, effects: 1, operations: 1 });
  });
}

test("timeout before effect remains unknown with zero effects", async () => {
  const provider = createSyntheticPaymentProvider({ scenario: "timeout_before_effect" });
  await assert.rejects(provider.execute(identity()), (error) => {
    assert.equal(error instanceof SyntheticProviderTimeoutError, true);
    assert.equal(error.outcome, "unknown");
    assert.equal(error.effectRecorded, false);
    return true;
  });
  await assert.rejects(provider.execute(identity()), SyntheticProviderTimeoutError);
  assert.deepEqual(provider.inspect(), { calls: 2, effects: 0, operations: 1 });
});

test("timeout after effect replays the same unknown effect without replacement", async () => {
  const callbacks = [];
  const provider = createSyntheticPaymentProvider({ scenario: "timeout_after_effect" });
  let firstError;
  await assert.rejects(provider.execute(identity(), { onCallback: (event) => callbacks.push(event) }), (error) => {
    firstError = error;
    assert.equal(error instanceof SyntheticProviderTimeoutError, true);
    assert.equal(error.effectRecorded, true);
    return true;
  });
  await assert.rejects(provider.execute(identity(), { onCallback: (event) => callbacks.push(event) }), (error) => {
    assert.equal(error.effectId, firstError.effectId);
    assert.deepEqual(error.safeEvent, firstError.safeEvent);
    return true;
  });
  assert.equal(new Set(callbacks.map((event) => event.providerEventId)).size, 1);
  assert.deepEqual(provider.inspect(), { calls: 2, effects: 1, operations: 1 });
});

test("callback before response converges before the returned result", async () => {
  const trace = [];
  const provider = createSyntheticPaymentProvider({ scenario: "callback_before_response" });
  const result = await provider.execute(identity(), {
    onCallback(event) {
      trace.push(`callback:${event.providerEventId}`);
    },
  });
  trace.push(`response:${result.effectId}`);
  assert.deepEqual(trace, [
    `callback:${result.safeEvent.providerEventId}`,
    `response:${result.effectId}`,
  ]);
});

test("duplicate callback has one business effect and out-of-order terminal evidence cannot regress", async () => {
  let current = null;
  let applied = 0;
  const callbacks = [];
  const provider = createSyntheticPaymentProvider({ scenario: "duplicate_callback" });
  const result = await provider.execute(identity(), {
    onCallback(event) {
      callbacks.push(event);
      const reduced = reduceSyntheticPaymentEvent({ current, event });
      if (reduced.disposition === "applied") applied += 1;
      current = reduced.state;
    },
  });
  assert.equal(callbacks.length, 2);
  assert.equal(applied, 1);
  assert.equal(current.status, "succeeded");
  const stale = reduceSyntheticPaymentEvent({
    current,
    event: {
      ...result.safeEvent,
      providerEventId: "synthetic_event_stale",
      type: "synthetic_payment.declined",
      providerCreatedAt: result.safeEvent.providerCreatedAt - 1,
    },
  });
  assert.equal(stale.disposition, "ignored_stale");
  assert.equal(stale.state.status, "succeeded");
});

test("synthetic provider rejects unsupported scenarios and any changed stable identity", async () => {
  assert.throws(() => createSyntheticPaymentProvider({ scenario: "network" }), /Unsupported synthetic scenario/);
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  await provider.execute(identity());
  await assert.rejects(
    provider.execute(identity({ requestHash: "b".repeat(64) })),
    SyntheticIdempotencyConflictError,
  );
  await assert.rejects(
    provider.execute(identity({ idempotencyKey: "different_idempotency" })),
    SyntheticIdempotencyConflictError,
  );
  await assert.rejects(
    provider.execute(identity({ operationId: "different_operation" })),
    SyntheticIdempotencyConflictError,
  );
  assert.deepEqual(provider.inspect(), { calls: 4, effects: 1, operations: 1 });
});

test("synthetic reducer rejects evidence for another operation or attempt", () => {
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  return provider.execute(identity()).then((result) => {
    const current = reduceSyntheticPaymentEvent({ current: null, event: result.safeEvent }).state;
    const mismatch = reduceSyntheticPaymentEvent({
      current,
      event: {
        ...result.safeEvent,
        providerEventId: "synthetic_event_other",
        providerCreatedAt: result.safeEvent.providerCreatedAt + 1,
        operationId: "operation_other",
      },
    });
    assert.equal(mismatch.disposition, "ignored_identity_mismatch");
    assert.deepEqual(mismatch.state, current);
  });
});

for (const [label, persistence, expectedStatus] of [
  ["kill switch", createSafetyPersistence({ enabled: false }), "kill_switch"],
  ["budget exhaustion", createSafetyPersistence({ reserveStatus: "budget_exhausted" }), "budget_exhausted"],
  ["reservation conflict", createSafetyPersistence({ reserveStatus: "conflict" }), "conflict"],
  ["control adapter failure", createSafetyPersistence({ failRead: true }), "adapter_failure"],
  ["reservation adapter failure", createSafetyPersistence({ failReserve: true }), "adapter_failure"],
]) {
  test(`${label} fails closed with zero synthetic-provider calls`, async () => {
    const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
    const controller = createLocalSafetyController({ persistence });
    const result = await controller.executeSynthetic({ claim: baseClaim, provider });
    assert.equal(result.status, expectedStatus);
    assert.equal(result.admitted, false);
    assert.equal(provider.inspect().calls, 0);
    if (label === "kill switch") assert.equal(persistence.calls.reserve, 1);
    if (label === "control adapter failure") assert.equal(persistence.calls.reserve, 0);
  });
}

test("missing control records a durable kill-switch refusal without provider calls", async () => {
  const persistence = createSafetyPersistence({ enabled: false });
  persistence.readSafetyControl = async () => null;
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const result = await createLocalSafetyController({ persistence }).executeSynthetic({ claim: baseClaim, provider });
  assert.equal(result.status, "kill_switch");
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(provider.inspect().calls, 0);
});

test("disabled control with inconsistent reservation fails closed without provider calls", async () => {
  const persistence = createSafetyPersistence({ enabled: true });
  persistence.readSafetyControl = async () => ({
    paymentAdmissionEnabled: false,
    version: 2,
    reasonCode: "operator_kill",
  });
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const result = await createLocalSafetyController({ persistence }).executeSynthetic({ claim: baseClaim, provider });
  assert.equal(result.status, "adapter_failure");
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(provider.inspect().calls, 0);
});

test("kill-switch refusal replays durably and changed claims conflict without provider calls", async () => {
  const persistence = createSafetyPersistence({ enabled: false });
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const first = await controller.executeSynthetic({ claim: baseClaim, provider });
  const replay = await controller.executeSynthetic({ claim: baseClaim, provider });
  const conflict = await controller.executeSynthetic({
    claim: { ...baseClaim, requestHash: "b".repeat(64) },
    provider,
  });
  assert.equal(first.status, "kill_switch");
  assert.equal(replay.status, "kill_switch");
  assert.equal(conflict.status, "conflict");
  assert.equal(persistence.calls.reserve, 3);
  assert.equal(provider.inspect().calls, 0);
});

test("reserved and replayed admission use the same provider operation", async () => {
  const persistence = createSafetyPersistence();
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const first = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(first.status, "executed");
  assert.equal(first.admission.status, "reserved");
  assert.equal(first.reconciliation, undefined);
  const replay = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(replay.status, "executed");
  assert.equal(replay.admission.status, "replay");
  assert.equal(replay.result.replay, true);
  assert.deepEqual(provider.inspect(), { calls: 2, effects: 1, operations: 1 });
});

test("post-effect callback failure becomes stable unknown and schedules one reconciliation", async () => {
  const persistence = createSafetyPersistence();
  const provider = createSyntheticPaymentProvider({ scenario: "timeout_after_effect" });
  const controller = createLocalSafetyController({ persistence });
  const rejectCallback = async () => { throw new Error("synthetic callback consumer failure"); };
  const first = await controller.executeSynthetic({ claim: baseClaim, provider, onCallback: rejectCallback });
  assert.equal(first.status, "unknown");
  assert.equal(first.effectRecorded, true);
  assert.equal(first.operation.status, "unknown");
  assert.equal(first.operation.attemptId, baseClaim.attemptId);
  assert.equal(first.reconciliation.status, "created");
  assert.equal(first.createReplacementAttempt, false);
  assert.equal(persistence.attempts.get(`${baseClaim.sessionId}:${baseClaim.runId}:${baseClaim.attemptId}`).state, "unknown");
  assert.equal(persistence.reconciliation.size, 1);
  assert.equal(persistence.outbox.size, 1);
  assert.deepEqual(provider.inspect(), { calls: 1, effects: 1, operations: 1 });

  const replay = await controller.executeSynthetic({ claim: baseClaim, provider, onCallback: rejectCallback });
  assert.equal(replay.status, "adapter_failure");
  assert.equal(replay.admitted, false);
  assert.equal(provider.inspect().calls, 1);
});

test("rejected Dax mark envelope cannot fabricate an unknown attempt", async () => {
  const persistence = createSafetyPersistence();
  persistence.markPaymentAttemptUnknown = async (_tx, scope) => ({
    status: "rejected",
    attempt: {
      id: scope.attemptId,
      session_id: scope.sessionId,
      run_id: scope.runId,
      operation_key: scope.operationId,
      state: "unknown",
    },
  });
  const provider = createSyntheticPaymentProvider({ scenario: "timeout_after_effect" });
  const controller = createLocalSafetyController({ persistence });
  await assert.rejects(
    controller.executeSynthetic({ claim: baseClaim, provider }),
    /mark and verify the durable payment attempt/i,
  );
  assert.equal(persistence.reconciliation.size, 0);
  assert.equal(persistence.outbox.size, 0);
});

test("outbox failure rolls back unknown-control creation atomically", async () => {
  const persistence = createSafetyPersistence({ failOutbox: true });
  const provider = createSyntheticPaymentProvider({ scenario: "timeout_after_effect" });
  const controller = createLocalSafetyController({ persistence });
  await assert.rejects(
    controller.executeSynthetic({ claim: baseClaim, provider }),
    /outbox write failure/,
  );
  assert.equal(persistence.reconciliation.size, 0);
  assert.equal(persistence.outbox.size, 0);
  assert.equal(persistence.attempts.get(`${baseClaim.sessionId}:${baseClaim.runId}:${baseClaim.attemptId}`).state, "submitted");
  assert.deepEqual(provider.inspect(), { calls: 1, effects: 1, operations: 1 });
});

test("existing reconciliation is durably verified and remains schedulable while admission is disabled", async () => {
  const persistence = createSafetyPersistence({ enabled: false });
  const controller = createLocalSafetyController({ persistence });
  await persistence.withTransaction(async (tx) => {
    await persistence.markPaymentAttemptUnknown(tx, {
      sessionId: baseClaim.sessionId,
      runId: baseClaim.runId,
      attemptId: baseClaim.attemptId,
      operationId: baseClaim.operationId,
    });
    await persistence.upsertReconciliationControl(tx, {
      id: "reconciliation_attempt_m3",
      sessionId: baseClaim.sessionId,
      runId: baseClaim.runId,
      attemptId: baseClaim.attemptId,
    });
  });
  const first = await controller.scheduleExistingReconciliation({
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: baseClaim.attemptId,
  });
  const duplicate = await controller.scheduleExistingReconciliation({
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: baseClaim.attemptId,
  });
  assert.equal(first.status, "created");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(persistence.outbox.size, 1);
  assert.equal(persistence.calls.read, 0);
  assert.equal(persistence.calls.reconciliationRead, 2);
});

test("wrapped unknown-attempt read is rejected because Dax contract is row or null", async () => {
  const persistence = createSafetyPersistence({ enabled: false });
  const key = `${baseClaim.sessionId}:${baseClaim.runId}:${baseClaim.attemptId}`;
  const unknown = { ...persistence.attempts.get(key), state: "unknown" };
  persistence.attempts.set(key, unknown);
  await persistence.withTransaction((tx) => persistence.upsertReconciliationControl(tx, {
    id: "reconciliation_wrapped_m3",
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: baseClaim.attemptId,
  }));
  persistence.readUnknownPaymentAttempt = async () => ({ status: "found", attempt: unknown });
  const controller = createLocalSafetyController({ persistence });
  await assert.rejects(controller.scheduleExistingReconciliation({
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: baseClaim.attemptId,
  }), /durable unknown attempt/i);
  assert.equal(persistence.outbox.size, 0);
});

test("pending control cannot reconcile a terminal durable attempt", async () => {
  const persistence = createSafetyPersistence({ enabled: false });
  const key = `${baseClaim.sessionId}:${baseClaim.runId}:${baseClaim.attemptId}`;
  persistence.attempts.set(key, { ...persistence.attempts.get(key), state: "succeeded" });
  await persistence.withTransaction((tx) => persistence.upsertReconciliationControl(tx, {
    id: "reconciliation_terminal_m3",
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: baseClaim.attemptId,
  }));
  const controller = createLocalSafetyController({ persistence });
  await assert.rejects(controller.scheduleExistingReconciliation({
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: baseClaim.attemptId,
  }), /durable unknown attempt/i);
  assert.equal(persistence.outbox.size, 0);
});

test("caller-supplied unknown status cannot fabricate reconciliation", async () => {
  const persistence = createSafetyPersistence({ enabled: false });
  const controller = createLocalSafetyController({ persistence });
  await assert.rejects(controller.scheduleExistingReconciliation({
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: "fabricated_attempt",
    status: "unknown",
  }), /durable unknown attempt/i);
  assert.equal(persistence.outbox.size, 0);
  assert.equal(persistence.calls.read, 0);
});

test("controller rolls back when attempt claim is rejected after reserve reserved", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => {
    persistence.calls.attemptClaim += 1;
    throw new Error("claim rejected; admission is not eligible.");
  };
  await assert.rejects(
    persistence.withTransaction(async (tx_) => {
      const reservation = await persistence.reserveSyntheticBudget(tx_, {
        id: baseClaim.admissionId,
        environment: baseClaim.environment,
        policyId: baseClaim.policyId,
        sessionId: baseClaim.sessionId,
        runId: baseClaim.runId,
        operationKey: baseClaim.operationId,
        attemptId: baseClaim.attemptId,
        requestHash: baseClaim.requestHash,
        amountMinor: baseClaim.amountMinor,
      });
      assert.equal(reservation.status, "reserved");
      const scope = {
        sessionId: baseClaim.sessionId,
        runId: baseClaim.runId,
        attemptId: baseClaim.attemptId,
        operationId: baseClaim.operationId,
        requestHash: baseClaim.requestHash,
      };
      await persistence.claimSyntheticPaymentAttempt(tx_, scope);
      // unreachable — claim throws
      return tx_;
    }),
    /claim rejected/
  );
  // withTransaction restored snapshots: attempts preserved, reservations cleared
  assert.equal(persistence.attempts.size, 1);
  assert.ok(persistence.reservations.size === 0);

  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "adapter_failure");
  assert.equal(admission.admitted, false);
  assert.ok(admission.retryable);
  assert.equal(persistence.calls.reserve, 2);
  assert.equal(persistence.calls.attemptClaim, 2); // once in withTransaction, once in admitSynthetic
});

test("controller does not claim for kill_switch", async () => {
  const persistence = createSafetyPersistence();
  persistence.reserveSyntheticBudget = async (_tx, claim) => ({
    status: "kill_switch",
    record: { id: claim.id },
  });
  persistence.claimSyntheticPaymentAttempt = async () => {
    throw new Error("SHOULD_NOT_BE_CALLED");
  };
  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "kill_switch");
  assert.equal(admission.admitted, false);
});

test("controller rejects terminal attempt before provider invocation", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => {
    persistence.calls.attemptClaim += 1;
    return {
      status: "ready",
      attempt: { sessionId: scope.sessionId, runId: scope.runId, attemptId: scope.attemptId, operationId: scope.operationId, requestHash: scope.requestHash, state: "processing" },
    };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "adapter_failure");
  assert.equal(admission.admitted, false);
  assert.ok(admission.retryable);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 1);
});

test("controller rejects already-unknown attempt before provider invocation", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => {
    persistence.calls.attemptClaim += 1;
    return {
      status: "ready",
      attempt: { sessionId: scope.sessionId, runId: scope.runId, attemptId: scope.attemptId, operationId: scope.operationId, requestHash: scope.requestHash, state: "unknown" },
    };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "adapter_failure");
  assert.equal(admission.admitted, false);
  assert.ok(admission.retryable);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 1);
});

test("controller rejects fabricated attempt state before provider invocation", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => {
    persistence.calls.attemptClaim += 1;
    return {
      status: "ready",
      attempt: { sessionId: scope.sessionId, runId: scope.runId, attemptId: scope.attemptId, operationId: scope.operationId, requestHash: scope.requestHash, state: "failed" },
    };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "adapter_failure");
  assert.equal(admission.admitted, false);
  assert.ok(admission.retryable);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 1);
});

test("controller rejects operation-id mismatch on claim", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => ({
    status: "rejected",
  });
  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "adapter_failure");
  assert.equal(admission.admitted, false);
});

test("controller rejects request-hash mismatch on claim", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => {
    persistence.calls.attemptClaim += 1;
    return { status: "ready", attempt: { sessionId: scope.sessionId, runId: scope.runId, attemptId: scope.attemptId, operationId: scope.operationId, requestHash: "b".repeat(64), state: "submitted" } };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "adapter_failure");
  assert.equal(admission.admitted, false);
  assert.ok(admission.retryable);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 1);
});

test("fresh reservation rolls back when attempt claim is rejected", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async () => {
    persistence.calls.attemptClaim += 1;
    return { status: "rejected" };
  };
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.admitSynthetic(baseClaim);
  assert.equal(result.admitted, false);
  assert.equal(result.status, "adapter_failure");
});

test("unknown replay does not resubmit provider", async () => {
  const persistence = createSafetyPersistence();
  const tx = await persistence.withTransaction(async (tx) => {
    await persistence.markPaymentAttemptUnknown(tx, {
      sessionId: baseClaim.sessionId,
      runId: baseClaim.runId,
      attemptId: baseClaim.attemptId,
      operationId: baseClaim.operationId,
    });
  });
  assert.equal(persistence.attempts.get(`${baseClaim.sessionId}:${baseClaim.runId}:${baseClaim.attemptId}`).state, "unknown");

  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => {
    persistence.calls.attemptClaim += 1;
    return {
      status: "ready",
      attempt: { sessionId: scope.sessionId, runId: scope.runId, attemptId: scope.attemptId, operationId: scope.operationId, requestHash: scope.requestHash, state: "unknown" },
    };
  };

  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.admitSynthetic(baseClaim);
  assert.equal(result.status, "adapter_failure");
  assert.equal(result.admitted, false);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.attemptClaim, 1);
});

test("executeSynthetic: claim reject yields zero provider calls and retryable", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async () => {
    persistence.calls.attemptClaim += 1;
    return { status: "rejected" };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(result.status, "adapter_failure");
  assert.equal(result.admitted, false);
  assert.ok(result.retryable);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 1);
});

test("executeSynthetic: terminal attempt yields zero provider calls and retryable", async () => {
  const persistence = createSafetyPersistence();
  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => {
    persistence.calls.attemptClaim += 1;
    return {
      status: "ready",
      attempt: { sessionId: scope.sessionId, runId: scope.runId, attemptId: scope.attemptId, operationId: scope.operationId, requestHash: scope.requestHash, state: "processing" },
    };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(result.status, "adapter_failure");
  assert.equal(result.admitted, false);
  assert.ok(result.retryable);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 1);
});

test("executeSynthetic: unknown replay yields zero provider calls and retryable", async () => {
  const persistence = createSafetyPersistence();
  const tx = await persistence.withTransaction(async (tx) => {
    await persistence.markPaymentAttemptUnknown(tx, {
      sessionId: baseClaim.sessionId,
      runId: baseClaim.runId,
      attemptId: baseClaim.attemptId,
      operationId: baseClaim.operationId,
    });
  });
  assert.equal(persistence.attempts.get(`${baseClaim.sessionId}:${baseClaim.runId}:${baseClaim.attemptId}`).state, "unknown");
  persistence.claimSyntheticPaymentAttempt = async (_tx, scope) => {
    persistence.calls.attemptClaim += 1;
    return {
      status: "ready",
      attempt: { sessionId: scope.sessionId, runId: scope.runId, attemptId: scope.attemptId, operationId: scope.operationId, requestHash: scope.requestHash, state: "unknown" },
    };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(result.status, "adapter_failure");
  assert.equal(result.admitted, false);
  assert.ok(result.retryable);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 1);
});

test("executeSynthetic: kill_switch skips claim, yields zero provider calls", async () => {
  const persistence = createSafetyPersistence();
  persistence.reserveSyntheticBudget = async (_tx, claim) => {
    persistence.calls.reserve += 1;
    return { status: "kill_switch", record: { id: claim.id } };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(result.status, "kill_switch");
  assert.equal(result.admitted, false);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 0);
});

test("executeSynthetic: conflict skips claim, yields zero provider calls", async () => {
  const persistence = createSafetyPersistence();
  persistence.reserveSyntheticBudget = async (_tx, claim) => {
    persistence.calls.reserve += 1;
    return { status: "conflict", record: { id: claim.id } };
  };
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(result.status, "conflict");
  assert.equal(result.admitted, false);
  assert.equal(provider.inspect().calls, 0);
  assert.equal(persistence.calls.reserve, 1);
  assert.equal(persistence.calls.attemptClaim, 0);
});

// Dax snake_case normalization boundary tests — defect 6243d89 follow-up
test("Dax snake_case Dax row normalizes to camelCase attempt contract", async () => {
  const tx = Object.freeze({ name: "tx" });
  const dataPersistence = {
    async withTransaction(w) { return w(tx); },
    async markPaymentAttemptUnknown() { return null; },
    async reserveSyntheticBudget() { return { status: "reserved", record: {} }; },
    async claimSyntheticPaymentAttempt() {
      return {
        status: "ready",
        attempt: {
          session_id: baseClaim.sessionId,
          run_id: baseClaim.runId,
          attempt_id: baseClaim.attemptId,
          operation_key: baseClaim.operationId,
          request_hash: baseClaim.requestHash,
          state: "submitted",
          id: baseClaim.attemptId,
        },
      };
    },
    async readSafetyControl() { return { paymentAdmissionEnabled: true, version: 1, reasonCode: "test" }; },
    async readUnknownPaymentAttempt() { return null; },
    async upsertReconciliationControl() {},
    async readReconciliationControl() { return null; },
    async createOutboxJob() { return { status: "created" }; },
  };
  const outboxPersistence = {
    async createOutboxJob() { return { status: "created" }; },
  };
  const persistence = createLocalSafetyPersistence({ dataPersistence, outboxPersistence });
  const controller = createLocalSafetyController({ persistence });
  const admission = await controller.admitSynthetic(baseClaim);
  assert.equal(admission.status, "reserved");
  assert.equal(admission.admitted, true);
});

test("Dax snake_case rejects malformed row missing session_id", async () => {
  const tx = Object.freeze({ name: "tx" });
  const dataPersistence = {
    async withTransaction(w) { return w(tx); },
    async markPaymentAttemptUnknown() { return null; },
    async reserveSyntheticBudget() { return { status: "reserved", record: {} }; },
    async claimSyntheticPaymentAttempt() {
      return {
        status: "ready",
        attempt: {
          run_id: "x",
          attempt_id: "x",
          operation_key: "x",
          request_hash: "x",
          state: "submitted",
        },
      };
    },
    async readSafetyControl() { return { paymentAdmissionEnabled: true, version: 1 }; },
    async readUnknownPaymentAttempt() { return null; },
    async upsertReconciliationControl() {},
    async readReconciliationControl() { return null; },
    async createOutboxJob() { return { status: "created" }; },
  };
  const outboxPersistence = {
    async createOutboxJob() { return { status: "created" }; },
  };
  const persistence = createLocalSafetyPersistence({ dataPersistence, outboxPersistence });
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.admitSynthetic(baseClaim);
  assert.equal(result.status, "adapter_failure");
  assert.equal(result.admitted, false);
});

test("Dax snake_case rejects wrapped/non-standard result shapes fail-closed", async () => {
  const tx = Object.freeze({ name: "tx" });
  const dataPersistence = {
    async withTransaction(w) { return w(tx); },
    async markPaymentAttemptUnknown() { return null; },
    async reserveSyntheticBudget() { return { status: "reserved", record: {} }; },
    async claimSyntheticPaymentAttempt() {
      return {
        status: "found",
        attempt: {
          session_id: baseClaim.sessionId,
          run_id: baseClaim.runId,
          state: "submitted",
        },
      };
    },
    async readSafetyControl() { return { paymentAdmissionEnabled: true, version: 1 }; },
    async readUnknownPaymentAttempt() { return null; },
    async upsertReconciliationControl() {},
    async readReconciliationControl() { return null; },
    async createOutboxJob() { return { status: "created" }; },
  };
  const outboxPersistence = {
    async createOutboxJob() { return { status: "created" }; },
  };
  const persistence = createLocalSafetyPersistence({ dataPersistence, outboxPersistence });
  const controller = createLocalSafetyController({ persistence });
  const result = await controller.admitSynthetic(baseClaim);
  assert.equal(result.status, "adapter_failure");
  assert.equal(result.admitted, false);
});

test("Dax snake_case preserves attempt id field in normalized contract", async () => {
  const tx = Object.freeze({ name: "tx" });
  const dataPersistence = {
    async withTransaction(w) { return w(tx); },
    async markPaymentAttemptUnknown() { return null; },
    async reserveSyntheticBudget() { return { status: "reserved", record: {} }; },
    async claimSyntheticPaymentAttempt() {
      return {
        status: "ready",
        attempt: {
          session_id: baseClaim.sessionId,
          run_id: baseClaim.runId,
          attempt_id: baseClaim.attemptId,
          operation_key: baseClaim.operationId,
          request_hash: baseClaim.requestHash,
          state: "submitted",
          id: "dax_attempt_row_123",
        },
      };
    },
    async readSafetyControl() { return { paymentAdmissionEnabled: true, version: 1 }; },
    async readUnknownPaymentAttempt() { return null; },
    async upsertReconciliationControl() {},
    async readReconciliationControl() { return null; },
    async createOutboxJob() { return { status: "created" }; },
  };
  const outboxPersistence = {
    async createOutboxJob() { return { status: "created" }; },
  };
  const persistence = createLocalSafetyPersistence({ dataPersistence, outboxPersistence });
  const result = await persistence.claimSyntheticPaymentAttempt(tx, {
    sessionId: baseClaim.sessionId,
    runId: baseClaim.runId,
    attemptId: baseClaim.attemptId,
    operationId: baseClaim.operationId,
    requestHash: baseClaim.requestHash,
  });
  assert.equal(result.status, "ready");
  assert.equal(result.attempt.id, "dax_attempt_row_123");
});
