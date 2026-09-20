import assert from "node:assert/strict";
import test from "node:test";

import { ACP_VERSION, RuntimeError } from "../lib/acp/runtime/index.mjs";
import { createLocalAcpComposition } from "../lib/composition/local-acp.mjs";
import { createPostgresPersistence } from "../lib/persistence/postgres.mjs";
import { createReliabilityPersistenceAdapter } from "../lib/persistence/reliability-adapter.mjs";
import { createSyntheticPaymentProvider } from "../lib/payments/synthetic-provider.mjs";
import { createLocalSafetyController } from "../lib/safety/local-controller.mjs";
import { createLocalSafetyPersistence } from "../lib/safety/persistence.mjs";

function createIntegratedPool() {
  const calls = [];
  const idempotency = new Map();
  const documents = new Map();
  const outbox = new Set();

  const client = {
    async query(text, values = []) {
      calls.push({ text, values: structuredClone(values) });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text)) return { rows: [], rowCount: 0 };

      if (text.startsWith("SELECT payment_admission_enabled")) {
        return { rows: [{ payment_admission_enabled: true, version: "1", reason_code: "local_test" }] };
      }
      if (text.startsWith("SELECT reserve_synthetic_budget")) {
        return { rows: [{ outcome: { status: "reserved", record: { id: values[0] } } }] };
      }
      if (text.startsWith("UPDATE payment_attempts SET state='unknown'")) {
        return { rows: [{ id: values[2], session_id: values[0], run_id: values[1], operation_key: values[3], state: "unknown" }], rowCount: 1 };
      }
      if (text.startsWith("SELECT * FROM payment_attempts") && text.includes("state='unknown'")) {
        return { rows: [{ id: values[2], session_id: values[0], run_id: values[1], operation_key: "operation_integration_1", state: "unknown" }] };
      }
      if (text.startsWith("INSERT INTO synthetic_reconciliation_controls")) {
        return { rows: [{ id: values[0], session_id: values[1], run_id: values[2], attempt_id: values[3], state: "pending" }] };
      }
      if (text.startsWith("INSERT INTO outbox_jobs")) {
        if (outbox.has(values[4])) return { rows: [], rowCount: 0 };
        outbox.add(values[4]);
        return { rows: [{ id: values[0], session_id: values[1], run_id: values[2], kind: values[3], dedupe_key: values[4], safe_payload: JSON.parse(values[5]), attempt_count: 0 }], rowCount: 1 };
      }

      if (text.startsWith("SELECT 1 FROM runs")) return { rows: [{ owned: true }] };
      if (text.startsWith("SELECT claim_idempotency")) {
        const key = values.slice(0, 3).join(":");
        const prior = idempotency.get(key);
        if (prior && prior.requestHash !== values[3]) return { rows: [{ outcome: "conflict" }] };
        if (prior) return { rows: [{ outcome: "replay" }] };
        idempotency.set(key, { requestHash: values[3], result: null });
        return { rows: [{ outcome: "created" }] };
      }
      if (text.startsWith("SELECT result FROM idempotency_keys")) {
        const record = idempotency.get(values.slice(0, 3).join(":"));
        return { rows: record ? [{ result: structuredClone(record.result) }] : [] };
      }
      if (text.startsWith("UPDATE idempotency_keys SET result")) {
        const record = idempotency.get(values.slice(0, 3).join(":"));
        if (!record || record.requestHash !== values[3] || record.result) return { rows: [], rowCount: 0 };
        record.result = JSON.parse(values[4]);
        return { rows: [{ key: values[2] }], rowCount: 1 };
      }
      if (text.startsWith("INSERT INTO checkouts")) return { rows: [], rowCount: 1 };
      if (text.startsWith("INSERT INTO acp_checkout_documents")) {
        documents.set(`${values[1]}:${values[2]}:${values[3]}:${values[0]}`, JSON.parse(values[4]));
        return { rows: [], rowCount: 1 };
      }
      if (text.startsWith("SELECT d.document")) {
        const document = documents.get(`${values[1]}:${values[2]}:${values[3]}:${values[0]}`);
        return { rows: document ? [{ document: structuredClone(document) }] : [] };
      }
      if (text.startsWith("UPDATE acp_checkout_documents")) {
        const key = `${values[1]}:${values[2]}:${values[3]}:${values[0]}`;
        if (!documents.has(key)) return { rows: [], rowCount: 0 };
        documents.set(key, JSON.parse(values[5]));
        return { rows: [{ checkout_id: values[0] }], rowCount: 1 };
      }
      if (text.startsWith("UPDATE checkouts")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected integration SQL: ${text}`);
    },
    release() {},
  };

  return {
    calls,
    outbox,
    connect: async () => client,
  };
}

const acpContext = {
  subject: "agent_local",
  sessionId: "sess_local001",
  runId: "run_local001",
};
const createInput = {
  line_items: [{ id: "item_1" }],
  currency: "usd",
  capabilities: {},
};

function createArgs(overrides = {}) {
  return {
    context: acpContext,
    input: createInput,
    idempotencyKey: "idem_local_1",
    requestId: "req_local_1",
    apiVersion: ACP_VERSION,
    ...overrides,
  };
}

test("real adapters compose safety admission, stable unknown recovery, and one outbox action", async () => {
  const pool = createIntegratedPool();
  const dataPersistence = createPostgresPersistence(pool);
  const outboxPersistence = createReliabilityPersistenceAdapter(dataPersistence, {
    createId: (prefix) => `${prefix}_integration_1`,
  });
  const persistence = createLocalSafetyPersistence({ dataPersistence, outboxPersistence });
  const controller = createLocalSafetyController({ persistence });
  const provider = createSyntheticPaymentProvider({ scenario: "timeout_after_effect" });
  const claim = {
    environment: "local",
    admissionId: "admission_integration_1",
    policyId: "policy_integration_1",
    sessionId: acpContext.sessionId,
    runId: acpContext.runId,
    operationId: "operation_integration_1",
    attemptId: "attempt_integration_1",
    idempotencyKey: "idempotency_integration_1",
    requestHash: "a".repeat(64),
    amountMinor: 100,
  };

  const result = await controller.executeSynthetic({ claim, provider });
  assert.equal(result.status, "unknown");
  assert.equal(result.effectRecorded, true);
  assert.equal(result.createReplacementAttempt, false);
  assert.equal(result.reconciliation.status, "created");
  assert.deepEqual([...pool.outbox], ["reconcile:attempt_integration_1"]);
  assert.equal(pool.calls.some(({ text }) => text.startsWith("UPDATE payment_attempts SET state='unknown'")), true);
  assert.equal(pool.calls.some(({ text }) => text.startsWith("INSERT INTO synthetic_reconciliation_controls")), true);
  assert.equal(pool.calls.some(({ text }) => text.startsWith("INSERT INTO outbox_jobs")), true);
});

test("PostgreSQL persistence composes durable non-payment ACP create/replay/retrieve with scoped ownership", async () => {
  const pool = createIntegratedPool();
  const persistence = createPostgresPersistence(pool);
  const { applicationPort } = createLocalAcpComposition({ persistence });

  assert.deepEqual(Object.keys(applicationPort).sort(), ["cancelCheckout", "createCheckout", "retrieveCheckout", "updateCheckout"]);
  assert.equal("completeCheckout" in applicationPort, false);
  assert.equal("delegatePayment" in applicationPort, false);

  const first = await applicationPort.createCheckout(createArgs());
  assert.equal(first.idempotentReplayed, false);
  assert.deepEqual(first.value.capabilities.payment.handlers, []);
  assert.equal(first.value.line_items.length, 1);
  assert.deepEqual(first.value.line_items[0], {
    id: "item_1",
    item: { id: "item_1" },
    quantity: 1,
    totals: [],
  });

  const replay = await applicationPort.createCheckout(createArgs({
    input: { capabilities: {}, currency: "usd", line_items: [{ id: "item_1" }] },
  }));
  assert.equal(replay.idempotentReplayed, true);
  assert.deepEqual(replay.value, first.value);

  const retrieved = await applicationPort.retrieveCheckout(createArgs({
    checkoutSessionId: first.value.id,
    input: undefined,
    idempotencyKey: undefined,
  }));
  assert.equal(retrieved.value.id, first.value.id);
  assert.deepEqual(retrieved.value.capabilities.payment.handlers, []);

  const updated = await applicationPort.updateCheckout(createArgs({
    checkoutSessionId: first.value.id,
    input: { order_notes: "Local only" },
    idempotencyKey: "idem_update_1",
  }));
  assert.equal(updated.value.status, "incomplete");
  assert.deepEqual(updated.value.capabilities.payment.handlers, []);

  const canceled = await applicationPort.cancelCheckout(createArgs({
    checkoutSessionId: first.value.id,
    input: {},
    idempotencyKey: "idem_cancel_1",
  }));
  assert.equal(canceled.value.status, "canceled");
  assert.deepEqual(canceled.value.capabilities.payment.handlers, []);

  const updateAfterCancel = await applicationPort.updateCheckout(createArgs({
    checkoutSessionId: first.value.id,
    input: { order_notes: "Must remain canceled" },
    idempotencyKey: "idem_update_after_cancel_1",
  }));
  assert.equal(updateAfterCancel.value.status, "canceled");
  assert.deepEqual(updateAfterCancel.value.capabilities.payment.handlers, []);

  await assert.rejects(
    applicationPort.createCheckout(createArgs({ input: { ...createInput, currency: "eur" } })),
    (error) => error instanceof RuntimeError && error.code === "idempotency_conflict",
  );

  await assert.rejects(
    applicationPort.retrieveCheckout(createArgs({
      context: { ...acpContext, subject: "agent_other" },
      checkoutSessionId: first.value.id,
      input: undefined,
      idempotencyKey: undefined,
    })),
    (error) => error instanceof RuntimeError && error.code === "not_found",
  );

  assert.equal(pool.calls.filter(({ text }) => text.startsWith("INSERT INTO checkouts")).length, 1);
  assert.equal(pool.calls.filter(({ text }) => text.startsWith("SELECT claim_idempotency")).length, 6);
});
