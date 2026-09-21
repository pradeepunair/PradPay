import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresPersistence } from "../lib/persistence/postgres.mjs";
import { validateAgainstVendoredSchema } from "../lib/acp/runtime/schema-validator.mjs";
import checkoutSchema from "../protocol/acp/upstream/spec/2026-04-17/json-schema/schema.agentic_checkout.json" with { type: "json" };

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
  const item = { id: "item_1", name: "Synthetic item", unit_amount: 125 };
  const created = await persistence.createAcpCheckout(pool.client, { ...base, input: {
    line_items: [item], currency: "usd", capabilities: { payment: { handlers: [{ id: "must_not_persist" }] } },
    buyer: { email: "synthetic@example.invalid" }, fulfillment_details: { name: "Synthetic Buyer" },
    locale: "en-US", timezone: "America/Chicago", metadata: { source: "test" }, quote_id: "quote_1",
  } });
  assert.equal(created.status, "created");
  assert.match(created.checkout.id, /^cs_/);
  assert.deepEqual(created.checkout.line_items, [{ id: "item_1", item, quantity: 1, totals: [] }]);
  assert.deepEqual(created.checkout.capabilities, { payment: { handlers: [] } });
  assert.equal(created.checkout.quote_id, "quote_1");
  assert.deepEqual(created.checkout.metadata, { source: "test" });
  assert.deepEqual(validateAgainstVendoredSchema(checkoutSchema, "CheckoutSession", created.checkout), { valid: true, errors: [] });
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

test("synthetic attempt claim atomically fences exact prepared and submitted attempts", async () => {
  const submitted = {
    id: "attempt_1", session_id: "session_1", run_id: "run_1",
    operation_key: "operation_1", request_hash: "hash_1", state: "submitted",
  };
  let accepted = true;
  const pool = fakePool(async (text) => {
    if (text.startsWith("WITH candidate AS MATERIALIZED")) return { rows: accepted ? [submitted] : [] };
    return { rows: [] };
  });
  const persistence = createPostgresPersistence(pool);
  const claim = { sessionId: "session_1", runId: "run_1", attemptId: "attempt_1", operationId: "operation_1", requestHash: "hash_1" };
  assert.deepEqual(await persistence.claimSyntheticPaymentAttempt(pool.client, claim), { status: "ready", attempt: submitted });
  assert.match(pool.calls[0].text, /FOR UPDATE/);
  assert.match(pool.calls[0].text, /c\.state='prepared'/);
  assert.match(pool.calls[0].text, /state='submitted'/);
  assert.deepEqual(pool.calls[0].values, ["session_1", "run_1", "attempt_1", "operation_1", "hash_1"]);
  accepted = false;
  assert.deepEqual(await persistence.claimSyntheticPaymentAttempt(pool.client, claim), { status: "rejected" });
});

test("unknown-attempt methods enforce owned state and operation scope", async () => {
  const unknown = { id: "attempt_1", session_id: "session_1", run_id: "run_1", state: "unknown" };
  let accepted = true;
  const pool = fakePool(async (text) => {
    if (text.startsWith("UPDATE payment_attempts")) return { rows: accepted ? [unknown] : [] };
    if (text.startsWith("SELECT * FROM payment_attempts")) return { rows: accepted ? [unknown] : [] };
    return { rows: [] };
  });
  const persistence = createPostgresPersistence(pool);
  const scope = { sessionId: "session_1", runId: "run_1", attemptId: "attempt_1", operationId: "operation_1" };
  assert.deepEqual(await persistence.markPaymentAttemptUnknown(pool.client, scope), { status: "updated", attempt: unknown });
  assert.equal((await persistence.readUnknownPaymentAttempt(pool.client, scope)).state, "unknown");
  assert.match(pool.calls[0].text, /state IN \('submitted','processing','unknown'\)/);
  assert.deepEqual(pool.calls[0].values, ["session_1", "run_1", "attempt_1", "operation_1"]);
  accepted = false;
  assert.deepEqual(await persistence.markPaymentAttemptUnknown(pool.client, scope), { status: "rejected" });
  assert.equal(await persistence.readUnknownPaymentAttempt(pool.client, scope), null);
});

test("ACP cancel is locked, replay-safe, and update cannot revive canceled state", async () => {
  let document = {
    id: "cs_locked", status: "ready_for_payment", currency: "usd",
    line_items: [{ id: "item_1", item: { id: "item_1" }, quantity: 1, totals: [] }],
    totals: [], fulfillment_options: [], messages: [], links: [], capabilities: { payment: { handlers: [] } },
    locale: "en-US", timezone: "America/Chicago", metadata: { source: "create" }, quote_id: "quote_1",
  };
  const pool = fakePool(async (text, values) => {
    if (text.startsWith("SELECT d.document") && /FOR UPDATE/.test(text)) return { rows: [{ document: structuredClone(document) }] };
    if (text.startsWith("UPDATE acp_checkout_documents")) {
      document = JSON.parse(values[5]);
      return { rows: [{ checkout_id: document.id }] };
    }
    return { rows: [], rowCount: 1 };
  });
  const persistence = createPostgresPersistence(pool);
  const scope = { checkoutSessionId: "cs_locked", subject: "agent", sessionId: "session", runId: "run", apiVersion: "2026-04-17" };
  const updated = await persistence.updateAcpCheckout(pool.client, { ...scope, input: {
    line_items: [{ id: "item_2", name: "Updated synthetic item" }], buyer: { email: "updated@example.invalid" },
    fulfillment_details: { name: "Updated Buyer" }, selected_fulfillment_options: [],
  } });
  assert.equal(updated.status, "updated");
  assert.deepEqual(updated.checkout.line_items, [{ id: "item_2", item: { id: "item_2", name: "Updated synthetic item" }, quantity: 1, totals: [] }]);
  assert.equal(updated.checkout.locale, "en-US");
  assert.equal(updated.checkout.quote_id, "quote_1");
  assert.deepEqual(validateAgainstVendoredSchema(checkoutSchema, "CheckoutSession", updated.checkout), { valid: true, errors: [] });
  assert.equal((await persistence.cancelAcpCheckout(pool.client, scope)).status, "canceled");
  assert.equal((await persistence.cancelAcpCheckout(pool.client, scope)).status, "canceled");
  assert.equal((await persistence.updateAcpCheckout(pool.client, { ...scope, input: { line_items: [{ id: "item_3" }] } })).status, "updated");
  assert.equal(document.status, "canceled");
  assert.equal(document.line_items[0].id, "item_2");
  assert.equal(pool.calls.filter((call) => call.text.startsWith("UPDATE acp_checkout_documents")).length, 2);
  for (const call of pool.calls.filter((item) => item.text.startsWith("SELECT d.document"))) assert.match(call.text, /FOR UPDATE OF d,c/);
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
