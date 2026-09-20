import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";

import { createLocalWebhookComposition } from "../lib/composition/local-webhook.mjs";

const endpointSecret = "local_m3_signing_secret_for_tests";
const nowSeconds = 1_788_921_000;
const authorizedScope = Object.freeze({ authorized: true, sessionId: "session_m3", runId: "run_m3" });
const resolveAuthorized = async () => authorizedScope;

function payload(overrides = {}) {
  return JSON.stringify({
    id: "evt_m3_local",
    object: "event",
    created: nowSeconds - 5,
    livemode: false,
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_m3_local", object: "payment_intent" } },
    ...overrides,
  });
}

function requestFor(body) {
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: endpointSecret,
    timestamp: nowSeconds,
  });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
}

function createPool({ receiptOutcome = "created", failReceipt = false } = {}) {
  const trace = [];
  let connects = 0;
  const client = {
    async query(sql) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        trace.push(sql);
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("record_webhook_receipt")) {
        trace.push("RECEIPT");
        if (failReceipt) throw new Error("synthetic persistence failure with private detail");
        return { rows: [{ outcome: receiptOutcome }], rowCount: 1 };
      }
      throw new Error(`Unexpected synthetic SQL: ${sql}`);
    },
    release() { trace.push("RELEASE"); },
  };
  return {
    trace,
    get connects() { return connects; },
    async connect() { connects += 1; return client; },
  };
}

test("local webhook composition requires pool, secret, resolver authorization, and business callback", () => {
  const pool = createPool();
  assert.throws(() => createLocalWebhookComposition({
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
    applyBusinessEvent: async () => ({ disposition: "applied" }),
  }), /pool/i);
  assert.throws(() => createLocalWebhookComposition({
    pool,
    endpointSecret: "",
    resolveProviderReference: resolveAuthorized,
    applyBusinessEvent: async () => ({ disposition: "applied" }),
  }), /endpointSecret/i);
  assert.throws(() => createLocalWebhookComposition({
    pool,
    endpointSecret,
    applyBusinessEvent: async () => ({ disposition: "applied" }),
  }), /resolveProviderReference/i);
  assert.throws(() => createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
  }), /applyBusinessEvent/i);
});

test("composition does not connect until a request is handled", () => {
  const pool = createPool();
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => ({ disposition: "applied" }),
  });
  assert.equal(pool.connects, 0);
  assert.equal(typeof composition.post, "function");
});

test("local composition verifies, records, applies allowlisted state, commits, then acknowledges", async () => {
  const pool = createPool();
  const applied = [];
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: async (tx, event) => {
      assert.ok(tx);
      assert.equal(event.objectId, "pi_m3_local");
      pool.trace.push("RESOLVE");
      return authorizedScope;
    },
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async (_tx, event, authorization) => {
      pool.trace.push("APPLY");
      applied.push({ event, authorization });
      return { disposition: "applied" };
    },
  });
  const response = await composition.post(requestFor(payload()));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, disposition: "applied" });
  assert.deepEqual(pool.trace, ["BEGIN", "RECEIPT", "RESOLVE", "APPLY", "COMMIT", "RELEASE"]);
  assert.equal(applied.length, 1);
  assert.deepEqual(applied[0], {
    event: {
      provider: "stripe",
      providerEventId: "evt_m3_local",
      type: "payment_intent.succeeded",
      providerCreatedAt: nowSeconds - 5,
      objectId: "pi_m3_local",
    },
    authorization: authorizedScope,
  });
});

test("unknown event type is durably received and safely ignored", async () => {
  const pool = createPool();
  let applied = 0;
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => { applied += 1; },
  });
  const response = await composition.post(requestFor(payload({ type: "charge.updated" })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, disposition: "ignored" });
  assert.equal(applied, 0);
  assert.deepEqual(pool.trace, ["BEGIN", "RECEIPT", "COMMIT", "RELEASE"]);
});

test("unknown object type is durably received but ignored before state mutation", async () => {
  const pool = createPool();
  let applied = 0;
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => { applied += 1; },
  });
  const body = payload({
    data: { object: { id: "pi_looks_valid", object: "customer" } },
  });
  const response = await composition.post(requestFor(body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, disposition: "ignored" });
  assert.equal(applied, 0);
  assert.deepEqual(pool.trace, ["BEGIN", "RECEIPT", "COMMIT", "RELEASE"]);
});

test("unsupported provider reference is received but cannot reach state mutation", async () => {
  const pool = createPool();
  let applied = 0;
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => { applied += 1; },
  });
  const body = payload({
    data: { object: { id: "https://not-a-provider-reference.invalid", object: "payment_intent" } },
  });
  const response = await composition.post(requestFor(body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, disposition: "ignored_provider_reference" });
  assert.equal(applied, 0);
  assert.deepEqual(pool.trace, ["BEGIN", "RECEIPT", "COMMIT", "RELEASE"]);
});

test("opaque provider reference cannot authorize or acknowledge when resolver is unresolved", async () => {
  const pool = createPool();
  let applied = 0;
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: async () => {
      pool.trace.push("RESOLVE");
      return null;
    },
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => { applied += 1; },
  });
  const response = await composition.post(requestFor(payload()));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Webhook receipt could not be durably recorded." });
  assert.equal(applied, 0);
  assert.deepEqual(pool.trace, ["BEGIN", "RECEIPT", "RESOLVE", "ROLLBACK", "RELEASE"]);
});

test("resolver failure rolls back the receipt and never mutates", async () => {
  const pool = createPool();
  let applied = 0;
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: async () => {
      pool.trace.push("RESOLVE");
      throw new Error("private resolver failure");
    },
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => { applied += 1; },
  });
  const response = await composition.post(requestFor(payload()));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Webhook receipt could not be durably recorded." });
  assert.equal(applied, 0);
  assert.deepEqual(pool.trace, ["BEGIN", "RECEIPT", "RESOLVE", "ROLLBACK", "RELEASE"]);
});

test("duplicate receipt is acknowledged without a second business mutation", async () => {
  const pool = createPool({ receiptOutcome: "duplicate" });
  let applied = 0;
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => { applied += 1; },
  });
  const response = await composition.post(requestFor(payload()));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, disposition: "duplicate" });
  assert.equal(applied, 0);
});

test("receipt persistence failure returns 503, rolls back, and never acknowledges or applies", async () => {
  const pool = createPool({ failReceipt: true });
  let applied = 0;
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => { applied += 1; },
  });
  const response = await composition.post(requestFor(payload()));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Webhook receipt could not be durably recorded." });
  assert.equal(applied, 0);
  assert.deepEqual(pool.trace, ["BEGIN", "RECEIPT", "ROLLBACK", "RELEASE"]);
});

test("business mutation failure rolls back the receipt and returns 503", async () => {
  const pool = createPool();
  const composition = createLocalWebhookComposition({
    pool,
    endpointSecret,
    resolveProviderReference: resolveAuthorized,
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async () => {
      pool.trace.push("APPLY");
      throw new Error("synthetic application failure");
    },
  });
  const response = await composition.post(requestFor(payload()));
  assert.equal(response.status, 503);
  assert.deepEqual(pool.trace, ["BEGIN", "RECEIPT", "APPLY", "ROLLBACK", "RELEASE"]);
});
