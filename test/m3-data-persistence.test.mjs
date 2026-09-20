import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresPersistence } from "../lib/persistence/postgres.mjs";

function fakePool(handler) {
  const calls = [];
  const client = { async query(text, values) { calls.push({ text, values }); return handler(text, values, calls); }, release() {} };
  return { calls, client, connect: async () => client };
}

test("missing safety control defaults disabled and control updates use optimistic versions", async () => {
  const pool = fakePool(async (text) => {
    if (text.startsWith("SELECT payment_admission")) return { rows: [] };
    if (text.startsWith("INSERT INTO safety_controls")) return { rows: [{ payment_admission_enabled: true, version: "1", reason_code: "local_test" }] };
    if (text.startsWith("UPDATE safety_controls")) return { rows: [] };
    return { rows: [] };
  });
  const persistence = createPostgresPersistence(pool);
  const tx = pool.client;
  assert.deepEqual(await persistence.readSafetyControl(tx, { environment: "local" }), {
    paymentAdmissionEnabled: false, version: 0, reasonCode: "missing_control",
  });
  assert.deepEqual(await persistence.setSafetyControl(tx, {
    environment: "local", paymentAdmissionEnabled: true, expectedVersion: 0, reasonCode: "local_test",
  }), { status: "updated", record: { paymentAdmissionEnabled: true, version: 1, reasonCode: "local_test" } });
  assert.deepEqual(await persistence.setSafetyControl(tx, {
    environment: "local", paymentAdmissionEnabled: false, expectedVersion: 9, reasonCode: "operator_stop",
  }), { status: "conflict" });
});

test("budget reservation exposes the exact stable result envelope", async () => {
  const outcome = { status: "reserved", record: { id: "admission_1", decision: "reserved" } };
  const pool = fakePool(async (text) => text.startsWith("SELECT reserve_synthetic_budget") ? { rows: [{ outcome }] } : { rows: [] });
  const persistence = createPostgresPersistence(pool);
  assert.deepEqual(await persistence.reserveSyntheticBudget(pool.client, {
    id: "admission_1", environment: "local", policyId: "policy_1", sessionId: "session_1", runId: "run_1",
    operationKey: "operation_1", attemptId: "attempt_1", requestHash: "hash_1", amountMinor: 100,
  }), outcome);
  assert.deepEqual(pool.calls[0].values.slice(1, 5), ["local", "policy_1", "session_1", "run_1"]);
});

test("ACP idempotency and repository methods match the application contract", async () => {
  const document = {
    id: "cs_local001", status: "ready_for_payment", currency: "usd", line_items: [], totals: [],
    fulfillment_options: [], messages: [], links: [], capabilities: { payment: { handlers: [] } },
  };
  const pool = fakePool(async (text) => {
    if (text.startsWith("SELECT 1 FROM runs")) return { rows: [{ "?column?": 1 }] };
    if (text.startsWith("SELECT claim_idempotency")) return { rows: [{ outcome: "created" }] };
    if (text.startsWith("UPDATE idempotency_keys")) return { rows: [{ key: "idem_1" }], rowCount: 1 };
    if (text.startsWith("SELECT d.document")) return { rows: [{ document }] };
    if (text.startsWith("UPDATE acp_checkout_documents")) return { rows: [{ checkout_id: document.id }] };
    return { rows: [], rowCount: 1 };
  });
  const persistence = createPostgresPersistence(pool);
  const base = { subject: "agent_local", sessionId: "sess_local001", runId: "run_local001", requestId: "req_1", apiVersion: "2026-04-17" };
  assert.equal((await persistence.claimAcpIdempotency(pool.client, { ...base, scope: "acp.checkout.create:collection", key: "idem_1", requestHash: "a".repeat(64) })).status, "created");
  assert.equal((await persistence.storeAcpIdempotentResponse(pool.client, { ...base, scope: "acp.checkout.create:collection", key: "idem_1", requestHash: "a".repeat(64), response: document })).status, "stored");
  const created = await persistence.createAcpCheckout(pool.client, { ...base, input: { line_items: [], currency: "usd", capabilities: {} } });
  assert.equal(created.status, "created");
  assert.match(created.checkout.id, /^cs_/);
  const scope = { ...base, checkoutSessionId: document.id };
  assert.equal((await persistence.retrieveAcpCheckout(pool.client, scope)).status, "found");
  assert.equal((await persistence.updateAcpCheckout(pool.client, { ...scope, input: { order_notes: "Local only" } })).status, "updated");
  assert.equal((await persistence.cancelAcpCheckout(pool.client, { ...scope, input: {} })).status, "canceled");
  for (const call of pool.calls.filter((item) => /acp_checkout_documents|checkouts/.test(item.text))) {
    assert.match(call.text, /session_id/);
    assert.match(call.text, /run_id/);
  }
  await assert.rejects(persistence.retrieveAcpCheckout(pool.client, { checkoutSessionId: document.id, subject: base.subject, sessionId: base.sessionId, apiVersion: base.apiVersion }), /runId/);
});

test("reconciliation methods remain independent of safety admission reads", async () => {
  const pool = fakePool(async (text) => {
    if (text.startsWith("INSERT INTO synthetic_reconciliation")) return { rows: [{ id: "recon_1", state: "pending" }] };
    if (text.startsWith("SELECT * FROM synthetic_reconciliation")) return { rows: [{ id: "recon_1", state: "pending" }] };
    if (text.startsWith("UPDATE synthetic_reconciliation")) return { rows: [{ id: "recon_1", state: "resolved", version: 2 }] };
    return { rows: [] };
  });
  const persistence = createPostgresPersistence(pool);
  const scope = { sessionId: "session_1", runId: "run_1", attemptId: "attempt_1" };
  assert.equal((await persistence.upsertReconciliationControl(pool.client, { id: "recon_1", ...scope })).state, "pending");
  assert.equal((await persistence.readReconciliationControl(pool.client, scope)).id, "recon_1");
  assert.equal((await persistence.updateReconciliationControl(pool.client, { ...scope, expectedVersion: 1, state: "resolved", resultCode: "synthetic_final" })).status, "updated");
  assert.equal(pool.calls.some((call) => /safety_controls/.test(call.text)), false);
});
