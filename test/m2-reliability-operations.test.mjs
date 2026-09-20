import assert from "node:assert/strict";
import test from "node:test";

import {
  claimOperation,
  IdempotencyConflictError,
} from "../lib/payments/idempotent-operations.mjs";
import {
  planUnknownOutcomeReconciliation,
  scheduleUnknownOutcomeReconciliation,
} from "../lib/reconciliation/unknown-outcomes.mjs";

function createPersistence() {
  const records = new Map();
  const operations = new Map();
  const outbox = new Map();
  let operationCreates = 0;
  return {
    records,
    outbox,
    get operationCreates() { return operationCreates; },
    async withTransaction(work) { return work({ records, operations, outbox }); },
    async claimIdempotency(tx, claim) {
      const id = `${claim.sessionId}:${claim.scope}:${claim.key}`;
      const existing = tx.records.get(id);
      if (!existing) {
        const record = Object.freeze({ ...claim, status: "prepared" });
        tx.records.set(id, record);
        return { status: "created", record };
      }
      if (existing.requestHash !== claim.requestHash) {
        return { status: "conflict", record: existing };
      }
      return { status: "replay", record: existing };
    },
    async createOperation(tx, { claim }) {
      operationCreates += 1;
      const operation = Object.freeze({
        operationId: `op_${claim.key}`,
        attemptId: `attempt_${claim.key}`,
        status: "prepared",
      });
      tx.operations.set(`${claim.sessionId}:${claim.scope}:${claim.key}`, operation);
      return operation;
    },
    async readOperation(tx, { claim }) {
      return tx.operations.get(`${claim.sessionId}:${claim.scope}:${claim.key}`);
    },
    async createOutboxJob(tx, job) {
      if (tx.outbox.has(job.dedupeKey)) return { status: "duplicate", job: tx.outbox.get(job.dedupeKey) };
      tx.outbox.set(job.dedupeKey, job);
      return { status: "created", job };
    },
  };
}

test("rejects malformed request hashes before claiming idempotency", async () => {
  const persistence = createPersistence();
  await assert.rejects(claimOperation({
    persistence,
    claim: {
      sessionId: "session_01",
      scope: "checkout.complete",
      key: "operation_01",
      requestHash: "not-a-sha256",
    },
    createOperation: persistence.createOperation,
  }), /SHA-256 requestHash/);
  assert.equal(persistence.records.size, 0);
});

test("same operation key and request hash replays one stable operation", async () => {
  const persistence = createPersistence();
  const claim = {
    sessionId: "session_01",
    scope: "checkout.complete",
    key: "operation_01",
    requestHash: "a".repeat(64),
  };
  const first = await claimOperation({
    persistence,
    claim,
    createOperation: persistence.createOperation,
    readOperation: persistence.readOperation,
  });
  const replay = await claimOperation({
    persistence,
    claim,
    createOperation: persistence.createOperation,
    readOperation: persistence.readOperation,
  });
  assert.equal(first.disposition, "created");
  assert.equal(replay.disposition, "replay");
  assert.deepEqual(replay.operation, first.operation);
  assert.equal(persistence.operationCreates, 1);
});

test("same operation key with a changed request hash conflicts", async () => {
  const persistence = createPersistence();
  const base = {
    sessionId: "session_01",
    scope: "checkout.complete",
    key: "operation_01",
  };
  await claimOperation({
    persistence,
    claim: { ...base, requestHash: "a".repeat(64) },
    createOperation: persistence.createOperation,
    readOperation: persistence.readOperation,
  });
  await assert.rejects(
    claimOperation({
      persistence,
      claim: { ...base, requestHash: "b".repeat(64) },
      createOperation: persistence.createOperation,
      readOperation: persistence.readOperation,
    }),
    IdempotencyConflictError,
  );
  assert.equal(persistence.operationCreates, 1);
});

test("unknown outcome recovery preserves the existing attempt", () => {
  const operation = {
    operationId: "op_01",
    attemptId: "attempt_01",
    sessionId: "session_01",
    runId: "run_01",
    status: "unknown",
  };
  const plan = planUnknownOutcomeReconciliation(operation);
  assert.deepEqual(plan, {
    action: "reconcile_existing_attempt",
    operationId: "op_01",
    attemptId: "attempt_01",
    holdAuthority: true,
    createReplacementAttempt: false,
  });
});

test("unknown outcome schedules one deduplicated reconciliation job", async () => {
  const persistence = createPersistence();
  const operation = {
    operationId: "op_01",
    attemptId: "attempt_01",
    sessionId: "session_01",
    runId: "run_01",
    status: "unknown",
  };
  const first = await scheduleUnknownOutcomeReconciliation({ persistence, operation });
  const duplicate = await scheduleUnknownOutcomeReconciliation({ persistence, operation });
  assert.equal(first.status, "created");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(persistence.outbox.size, 1);
  const [job] = persistence.outbox.values();
  assert.equal(job.dedupeKey, "reconcile:attempt_01");
  assert.deepEqual(job.safePayload, {
    operationId: "op_01",
    attemptId: "attempt_01",
    sessionId: "session_01",
    runId: "run_01",
  });
});

test("reconciliation refuses non-unknown or attempt-less operations", async () => {
  const persistence = createPersistence();
  await assert.rejects(
    scheduleUnknownOutcomeReconciliation({
      persistence,
      operation: { operationId: "op_01", status: "prepared" },
    }),
    /unknown operation with an existing attempt/i,
  );
  assert.equal(persistence.outbox.size, 0);
});

test("reconciliation refuses an unknown operation without ownership scope", async () => {
  const persistence = createPersistence();
  await assert.rejects(
    scheduleUnknownOutcomeReconciliation({
      persistence,
      operation: {
        operationId: "op_01",
        attemptId: "attempt_01",
        status: "unknown",
      },
    }),
    /sessionId and runId/i,
  );
  assert.equal(persistence.outbox.size, 0);
});
