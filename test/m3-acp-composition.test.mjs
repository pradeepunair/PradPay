import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ACP_VERSION, RuntimeError, createAcpRuntimeHandler, validateAcpPayload } from "../lib/acp/runtime/index.mjs";
import { createLocalAcpApplicationPort } from "../lib/application/local-acp-port.mjs";
import { createLocalAcpComposition } from "../lib/composition/local-acp.mjs";

const context = { subject: "agent_local", sessionId: "sess_local001", runId: "run_local001" };
const otherContext = { subject: "agent_other", sessionId: "sess_other001", runId: "run_other001" };
const createInput = { line_items: [{ id: "item_1" }], currency: "usd", capabilities: {} };

function checkout(id = "cs_local001", overrides = {}) {
  return {
    id,
    status: "ready_for_payment",
    currency: "usd",
    line_items: [],
    totals: [],
    fulfillment_options: [],
    messages: [],
    links: [],
    capabilities: { payment: { handlers: [{ id: "repository-must-not-advertise" }] } },
    ...overrides,
  };
}

function fakePersistence({ failStoreOnce = false } = {}) {
  const checkouts = new Map();
  const idempotency = new Map();
  const calls = [];
  let sequence = 0;

  function ownedKey({ subject, sessionId, runId, checkoutSessionId }) {
    return `${subject}:${sessionId}:${runId}:${checkoutSessionId}`;
  }

  function restoreMap(target, snapshot) {
    target.clear();
    for (const [key, value] of snapshot) target.set(key, value);
  }

  return {
    calls,
    async withTransaction(work) {
      calls.push(["withTransaction"]);
      const checkoutSnapshot = structuredClone([...checkouts]);
      const idempotencySnapshot = structuredClone([...idempotency]);
      try {
        return await work({ id: `tx_${calls.length}` });
      } catch (error) {
        restoreMap(checkouts, checkoutSnapshot);
        restoreMap(idempotency, idempotencySnapshot);
        throw error;
      }
    },
    async claimAcpIdempotency(_tx, claim) {
      calls.push(["claimAcpIdempotency", structuredClone(claim)]);
      const key = `${claim.subject}:${claim.sessionId}:${claim.runId}:${claim.scope}:${claim.key}`;
      const prior = idempotency.get(key);
      if (prior && prior.requestHash !== claim.requestHash) return { status: "conflict" };
      if (prior?.response) return { status: "replay", response: structuredClone(prior.response) };
      idempotency.set(key, { requestHash: claim.requestHash });
      return { status: "created" };
    },
    async storeAcpIdempotentResponse(_tx, record) {
      calls.push(["storeAcpIdempotentResponse", structuredClone(record)]);
      if (failStoreOnce) {
        failStoreOnce = false;
        throw new Error("synthetic store failure");
      }
      const key = `${record.subject}:${record.sessionId}:${record.runId}:${record.scope}:${record.key}`;
      const prior = idempotency.get(key);
      assert.equal(prior.requestHash, record.requestHash);
      prior.response = structuredClone(record.response);
      return { status: "stored" };
    },
    async createAcpCheckout(_tx, args) {
      calls.push(["createAcpCheckout", structuredClone(args)]);
      const value = checkout(`cs_local${String(++sequence).padStart(3, "0")}`);
      checkouts.set(ownedKey({ ...args, checkoutSessionId: value.id }), value);
      return { status: "created", checkout: structuredClone(value) };
    },
    async retrieveAcpCheckout(_tx, args) {
      calls.push(["retrieveAcpCheckout", structuredClone(args)]);
      const value = checkouts.get(ownedKey(args));
      return value ? { status: "found", checkout: structuredClone(value) } : { status: "not_found" };
    },
    async updateAcpCheckout(_tx, args) {
      calls.push(["updateAcpCheckout", structuredClone(args)]);
      const key = ownedKey(args);
      const current = checkouts.get(key);
      if (!current) return { status: "not_found" };
      const value = { ...current, status: "incomplete", metadata: { note: args.input.order_notes } };
      checkouts.set(key, value);
      return { status: "updated", checkout: structuredClone(value) };
    },
    async cancelAcpCheckout(_tx, args) {
      calls.push(["cancelAcpCheckout", structuredClone(args)]);
      const key = ownedKey(args);
      const current = checkouts.get(key);
      if (!current) return { status: "not_found" };
      const value = { ...current, status: "canceled" };
      checkouts.set(key, value);
      return { status: "canceled", checkout: structuredClone(value) };
    },
  };
}

function args(overrides = {}) {
  return {
    context,
    input: createInput,
    idempotencyKey: "idem_local_1",
    requestId: "req_local_1",
    apiVersion: ACP_VERSION,
    ...overrides,
  };
}

test("local ACP port composes durable create, retrieve, update, and cancel", async () => {
  const persistence = fakePersistence();
  const port = createLocalAcpApplicationPort({ persistence });
  assert.deepEqual(Object.keys(port).sort(), ["cancelCheckout", "createCheckout", "retrieveCheckout", "updateCheckout"]);

  const created = await port.createCheckout(args());
  assert.equal(created.idempotentReplayed, false);
  assert.deepEqual(created.value.capabilities.payment.handlers, []);
  assert.equal(validateAcpPayload("create", "response", created.value).valid, true);

  const checkoutSessionId = created.value.id;
  const retrieved = await port.retrieveCheckout(args({ checkoutSessionId, input: undefined, idempotencyKey: undefined }));
  assert.equal(retrieved.value.id, checkoutSessionId);

  const updated = await port.updateCheckout(args({ checkoutSessionId, input: { order_notes: "Local only" }, idempotencyKey: "idem_update_1" }));
  assert.equal(updated.value.status, "incomplete");
  assert.deepEqual(updated.value.capabilities.payment.handlers, []);

  const canceled = await port.cancelCheckout(args({ checkoutSessionId, input: {}, idempotencyKey: "idem_cancel_1" }));
  assert.equal(canceled.value.status, "canceled");
  assert.deepEqual(canceled.value.capabilities.payment.handlers, []);
  assert.equal(persistence.calls.filter(([name]) => name === "withTransaction").length, 4);
});

test("identical mutation replays the exact persisted response without a second mutation", async () => {
  const persistence = fakePersistence();
  const port = createLocalAcpApplicationPort({ persistence });
  const first = await port.createCheckout(args());
  const replay = await port.createCheckout(args({ input: { capabilities: {}, currency: "usd", line_items: [{ id: "item_1" }] } }));
  assert.deepEqual(replay.value, first.value);
  assert.equal(replay.idempotentReplayed, true);
  assert.equal(persistence.calls.filter(([name]) => name === "createAcpCheckout").length, 1);
});

test("changed mutation payload conflicts durably", async () => {
  const persistence = fakePersistence();
  const port = createLocalAcpApplicationPort({ persistence });
  await port.createCheckout(args());
  await assert.rejects(
    port.createCheckout(args({ input: { ...createInput, currency: "eur" } })),
    (error) => error instanceof RuntimeError && error.code === "idempotency_conflict",
  );
  assert.equal(persistence.calls.filter(([name]) => name === "createAcpCheckout").length, 1);
});

test("session and run scope prevent opaque-ID cross-owner reads and mutations", async () => {
  const persistence = fakePersistence();
  const port = createLocalAcpApplicationPort({ persistence });
  const created = await port.createCheckout(args());
  const checkoutSessionId = created.value.id;
  await assert.rejects(
    port.retrieveCheckout(args({ context: otherContext, checkoutSessionId, input: undefined, idempotencyKey: undefined })),
    (error) => error instanceof RuntimeError && error.code === "not_found",
  );
  await assert.rejects(
    port.cancelCheckout(args({ context: otherContext, checkoutSessionId, input: {}, idempotencyKey: "idem_other" })),
    (error) => error instanceof RuntimeError && error.code === "not_found",
  );
  await assert.rejects(
    port.retrieveCheckout(args({ context: { ...context, subject: "agent_other" }, checkoutSessionId, input: undefined, idempotencyKey: undefined })),
    (error) => error instanceof RuntimeError && error.code === "not_found",
  );
});

test("validates context, request metadata, repository envelopes, and response schemas", async () => {
  const persistence = fakePersistence();
  const port = createLocalAcpApplicationPort({ persistence });
  await assert.rejects(port.createCheckout(args({ apiVersion: "2026-01-30" })), (error) => error.code === "unsupported_version");
  await assert.rejects(port.createCheckout(args({ requestId: "bad request id" })), (error) => error.code === "invalid_request");
  await assert.rejects(port.createCheckout(args({ context: { ...context, subject: "" } })), (error) => error.code === "forbidden");

  persistence.createAcpCheckout = async () => ({ status: "created", checkout: { id: "cs_invalid" } });
  await assert.rejects(port.createCheckout(args({ idempotencyKey: "idem_invalid_response" })), (error) => error.code === "internal_error");
});

test("transaction rollback removes partial mutation and idempotency state", async () => {
  const persistence = fakePersistence({ failStoreOnce: true });
  const port = createLocalAcpApplicationPort({ persistence });
  await assert.rejects(port.createCheckout(args()), (error) => error.code === "service_unavailable");
  const retried = await port.createCheckout(args({ requestId: "req_local_2" }));
  assert.equal(retried.idempotentReplayed, false);
  assert.equal(persistence.calls.filter(([name]) => name === "createAcpCheckout").length, 2);
});

test("missing or failing persistence fails closed", async () => {
  assert.throws(() => createLocalAcpApplicationPort(), /persistence/);
  assert.throws(() => createLocalAcpComposition(), /persistence/);
  const persistence = fakePersistence();
  persistence.withTransaction = async () => { throw new Error("private repository diagnostic"); };
  const port = createLocalAcpApplicationPort({ persistence });
  await assert.rejects(port.createCheckout(args()), (error) => error instanceof RuntimeError && error.code === "service_unavailable" && !error.message.includes("private"));
});

test("composition is explicit, does not auto-enable admission, and exposes no payment methods", () => {
  const persistence = fakePersistence();
  const composition = createLocalAcpComposition({ persistence });
  assert.deepEqual(Object.keys(composition), ["applicationPort"]);
  assert.equal("completeCheckout" in composition.applicationPort, false);
  assert.equal("delegatePayment" in composition.applicationPort, false);
});

test("runtime hard blocks complete and delegate-payment before composed port lookup", async () => {
  const persistence = fakePersistence();
  const { applicationPort } = createLocalAcpComposition({ persistence });
  const handler = createAcpRuntimeHandler({
    port: applicationPort,
    authenticate: async () => ({ subject: context.subject, sessionId: context.sessionId, runIds: [context.runId] }),
    flags: { admission: true, complete: true, delegatePayment: true },
    createRequestId: () => "req_runtime_1",
  });
  const headers = {
    Authorization: "Bearer synthetic-only",
    "API-Version": ACP_VERSION,
    "PaymentLab-Session-Id": context.sessionId,
    "PaymentLab-Run-Id": context.runId,
    "Idempotency-Key": "idem_blocked",
    "Content-Type": "application/json",
  };
  const complete = await handler(new Request("https://local.invalid/checkout_sessions/cs_local001/complete", {
    method: "POST", headers, body: JSON.stringify({ payment_data: { handler_id: "none", instrument: { type: "synthetic", credential: { type: "synthetic", token: "non-reusable" } } } }),
  }), { operation: "complete", checkoutSessionId: "cs_local001" });
  const delegated = await handler(new Request("https://local.invalid/agentic_commerce/delegate_payment", {
    method: "POST", headers, body: JSON.stringify({ payment_method: { type: "card", card_number_type: "network_token", number: "non-reusable", display_card_funding_type: "credit", metadata: {} }, allowance: { reason: "one_time", max_amount: 1, currency: "usd", checkout_session_id: "cs_local001", merchant_id: "none", expires_at: "2030-01-01T00:00:00Z" }, risk_signals: [], metadata: {} }),
  }), { operation: "delegate-payment" });
  assert.equal((await complete.json()).code, "capability_blocked");
  assert.equal((await delegated.json()).code, "capability_blocked");
  assert.equal(persistence.calls.length, 0);
});

test("disabled admission blocks composed CRUD before repository access", async () => {
  const persistence = fakePersistence();
  const { applicationPort } = createLocalAcpComposition({ persistence });
  const handler = createAcpRuntimeHandler({
    port: applicationPort,
    authenticate: async () => ({ subject: context.subject, sessionId: context.sessionId, runIds: [context.runId] }),
    flags: {},
    createRequestId: () => "req_runtime_2",
  });
  const response = await handler(new Request("https://local.invalid/checkout_sessions/cs_local001", {
    headers: { Authorization: "Bearer synthetic-only", "API-Version": ACP_VERSION, "PaymentLab-Session-Id": context.sessionId, "PaymentLab-Run-Id": context.runId },
  }), { operation: "retrieve", checkoutSessionId: "cs_local001" });
  assert.equal((await response.json()).code, "capability_blocked");
  assert.equal(persistence.calls.length, 0);
});

test("new local ACP modules have no implicit credentials, provider, network, or payment imports", async () => {
  const sources = await Promise.all([
    readFile(new URL("../lib/application/local-acp-port.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/composition/local-acp.mjs", import.meta.url), "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /process\.env|stripe|https?:|fetch\(|node:(?:http|https|net|tls)|completeCheckout|delegatePayment/i);
  }
});
