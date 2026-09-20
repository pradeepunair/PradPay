import assert from "node:assert/strict";
import test from "node:test";

import { createLocalSafetyController } from "../lib/safety/local-controller.mjs";
import {
  createSyntheticPaymentProvider,
  reduceSyntheticPaymentEvent,
  SyntheticIdempotencyConflictError,
  SyntheticProviderTimeoutError,
} from "../lib/payments/synthetic-provider.mjs";
import { scheduleUnknownOutcomeReconciliation } from "../lib/reconciliation/unknown-outcomes.mjs";

const baseClaim = Object.freeze({
  environment: "local",
  sessionId: "session_m3",
  runId: "run_m3",
  operationId: "operation_m3",
  attemptId: "attempt_m3",
  idempotencyKey: "idempotency_m3",
  requestHash: "a".repeat(64),
  amountMinor: 1250,
});

function createSafetyPersistence({ enabled = true, reserveStatus = "reserved", failRead = false, failReserve = false } = {}) {
  const reservations = new Map();
  const outbox = new Map();
  const calls = { read: 0, reserve: 0 };
  return {
    calls,
    outbox,
    async withTransaction(work) { return work({ reservations, outbox }); },
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
      if (reserveStatus !== "reserved") return { status: reserveStatus };
      const key = `${claim.environment}:${claim.operationId}:${claim.attemptId}:${claim.idempotencyKey}`;
      const existing = tx.reservations.get(key);
      if (existing) {
        return existing.requestHash === claim.requestHash
          ? { status: "replay", record: existing }
          : { status: "conflict", record: existing };
      }
      const record = Object.freeze({ ...claim, reservationId: "reservation_m3" });
      tx.reservations.set(key, record);
      return { status: "reserved", record };
    },
    async createOutboxJob(tx, job) {
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
  });
}

test("missing control defaults disabled without attempting budget reservation", async () => {
  const persistence = createSafetyPersistence();
  persistence.readSafetyControl = async () => null;
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const result = await createLocalSafetyController({ persistence }).executeSynthetic({ claim: baseClaim, provider });
  assert.equal(result.status, "kill_switch");
  assert.equal(persistence.calls.reserve, 0);
  assert.equal(provider.inspect().calls, 0);
});

test("reserved and replayed admission use the same provider operation", async () => {
  const persistence = createSafetyPersistence();
  const provider = createSyntheticPaymentProvider({ scenario: "succeeded" });
  const controller = createLocalSafetyController({ persistence });
  const first = await controller.executeSynthetic({ claim: baseClaim, provider });
  const replay = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(first.status, "executed");
  assert.equal(first.admission.status, "reserved");
  assert.equal(replay.admission.status, "replay");
  assert.equal(replay.result.replay, true);
  assert.deepEqual(provider.inspect(), { calls: 2, effects: 1, operations: 1 });
});

test("timeout after effect automatically preserves and schedules the existing attempt once", async () => {
  const persistence = createSafetyPersistence();
  const provider = createSyntheticPaymentProvider({ scenario: "timeout_after_effect" });
  const controller = createLocalSafetyController({ persistence });
  const first = await controller.executeSynthetic({ claim: baseClaim, provider });
  const replay = await controller.executeSynthetic({ claim: baseClaim, provider });
  assert.equal(first.status, "unknown");
  assert.equal(first.effectRecorded, true);
  assert.equal(first.operation.status, "unknown");
  assert.equal(first.operation.attemptId, baseClaim.attemptId);
  assert.equal(first.reconciliation.status, "created");
  assert.equal(replay.reconciliation.status, "duplicate");
  assert.equal(first.createReplacementAttempt, false);
  assert.equal(persistence.outbox.size, 1);
  assert.deepEqual(provider.inspect(), { calls: 2, effects: 1, operations: 1 });
});

test("existing unknown attempt reconciliation remains allowed while admission is disabled", async () => {
  const persistence = createSafetyPersistence({ enabled: false });
  const controller = createLocalSafetyController({ persistence });
  const operation = {
    operationId: "operation_unknown",
    attemptId: "attempt_unknown",
    sessionId: "session_m3",
    runId: "run_m3",
    status: "unknown",
  };
  const permitted = controller.permitExistingReconciliation(operation);
  assert.deepEqual(permitted, {
    allowed: true,
    attemptId: "attempt_unknown",
    createReplacementAttempt: false,
  });
  const first = await scheduleUnknownOutcomeReconciliation({ persistence, operation });
  const duplicate = await scheduleUnknownOutcomeReconciliation({ persistence, operation });
  assert.equal(first.status, "created");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(persistence.outbox.size, 1);
  assert.equal(persistence.calls.read, 0);
});
