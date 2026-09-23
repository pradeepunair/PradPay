import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";

import { createStripeWebhookPost } from "../lib/payments/stripe-webhook-route.mjs";
import {
  applyStripePaymentEvent,
  createStripeWebhookReceiptService,
} from "../lib/payments/stripe-webhook-receipts.mjs";

const endpointSecret = "local_signing_secret_for_tests";
const nowSeconds = 1_788_920_100;

function eventPayload(overrides = {}) {
  return JSON.stringify({
    id: "evt_m2_fixture",
    object: "event",
    created: nowSeconds - 10,
    livemode: false,
    type: "payment_intent.processing",
    data: {
      object: {
        id: "pi_m2_fixture",
        object: "payment_intent",
        status: "processing",
      },
    },
    ...overrides,
  });
}

function signedRequest(payload, { secret = endpointSecret, timestamp = nowSeconds } = {}) {
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
}

function createPersistence({ failReceipt = false } = {}) {
  const state = { receipts: new Map(), effects: [], transactionCommits: 0 };
  return {
    state,
    async withTransaction(work) {
      const snapshot = structuredClone(state);
      const tx = { state };
      try {
        const result = await work(tx);
        state.transactionCommits += 1;
        return result;
      } catch (error) {
        state.receipts = snapshot.receipts;
        state.effects = snapshot.effects;
        state.transactionCommits = snapshot.transactionCommits;
        throw error;
      }
    },
    async recordWebhookReceipt(tx, receipt) {
      assert.equal(Object.hasOwn(receipt, "rawBody"), false);
      assert.equal(Object.hasOwn(receipt, "signature"), false);
      if (failReceipt) throw new Error("synthetic durable-store failure");
      if (tx.state.receipts.has(receipt.providerEventId)) {
        return { status: "duplicate", receipt: tx.state.receipts.get(receipt.providerEventId) };
      }
      tx.state.receipts.set(receipt.providerEventId, receipt);
      return { status: "created", receipt };
    },
  };
}

function createHarness(options = {}) {
  const persistence = createPersistence(options);
  const service = createStripeWebhookReceiptService({
    persistence,
    now: () => nowSeconds * 1000,
    applyBusinessEvent: async (tx, event) => {
      tx.state.effects.push(event.providerEventId);
      return { disposition: "applied" };
    },
  });
  const post = createStripeWebhookPost({
    receiptService: service,
    endpointSecret: () => endpointSecret,
  });
  return { persistence, post, service };
}

test("verifies untouched raw bytes before parsing or persistence", async () => {
  const calls = [];
  const persistence = createPersistence();
  const service = createStripeWebhookReceiptService({
    persistence,
    now: () => nowSeconds * 1000,
    verifyEvent({ rawBody }) {
      calls.push(["verify", Buffer.from(rawBody).toString("utf8")]);
      return JSON.parse(Buffer.from(rawBody).toString("utf8"));
    },
    applyBusinessEvent: async () => calls.push(["apply"]),
  });
  const rawBody = Buffer.from(eventPayload());
  await service.receive({ rawBody, signature: "synthetic_signature", endpointSecret });
  assert.equal(calls[0][0], "verify");
  assert.equal(calls[0][1], rawBody.toString("utf8"));
  assert.equal(persistence.state.receipts.size, 1);
});

test("receipt service fails closed when no business-event handler is composed", () => {
  assert.throws(
    () => createStripeWebhookReceiptService({ persistence: createPersistence() }),
    /applyBusinessEvent/i,
  );
});

test("missing or invalid signatures mutate no trusted state", async () => {
  const { persistence, post } = createHarness();
  const missing = await post(new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: eventPayload(),
  }));
  assert.equal(missing.status, 400);

  const invalid = await post(signedRequest(eventPayload(), { secret: "different_secret" }));
  assert.equal(invalid.status, 400);
  assert.equal(persistence.state.receipts.size, 0);
  assert.equal(persistence.state.effects.length, 0);
});

test("stale signatures and live-mode events mutate nothing", async () => {
  const { persistence, post } = createHarness();
  const stale = await post(signedRequest(eventPayload(), { timestamp: nowSeconds - 301 }));
  assert.equal(stale.status, 400);

  const live = await post(signedRequest(eventPayload({ livemode: true })));
  assert.equal(live.status, 400);
  assert.equal(persistence.state.receipts.size, 0);
  assert.equal(persistence.state.effects.length, 0);
});

test("durably records a minimal safe receipt before acknowledgement", async () => {
  const { persistence, post } = createHarness();
  const response = await post(signedRequest(eventPayload()));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, disposition: "applied" });
  const receipt = persistence.state.receipts.get("evt_m2_fixture");
  assert.deepEqual(Object.keys(receipt).sort(), [
    "livemode",
    "payloadSha256",
    "provider",
    "providerCreatedAt",
    "providerEventId",
    "receivedAt",
    "type",
  ]);
  assert.match(receipt.payloadSha256, /^[a-f0-9]{64}$/);
  assert.equal(persistence.state.transactionCommits, 1);
});

test("receipt persistence failure fails closed and does not acknowledge or apply", async () => {
  const { persistence, post } = createHarness({ failReceipt: true });
  const response = await post(signedRequest(eventPayload()));
  assert.equal(response.status, 503);
  assert.equal(persistence.state.receipts.size, 0);
  assert.equal(persistence.state.effects.length, 0);
});

test("duplicate provider events produce one business effect", async () => {
  const { persistence, post } = createHarness();
  const first = await post(signedRequest(eventPayload()));
  const duplicate = await post(signedRequest(eventPayload()));
  assert.equal(first.status, 200);
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { received: true, disposition: "duplicate" });
  assert.equal(persistence.state.receipts.size, 1);
  assert.deepEqual(persistence.state.effects, ["evt_m2_fixture"]);
});

test("terminal payment state does not regress on out-of-order evidence", () => {
  const succeeded = applyStripePaymentEvent({
    current: null,
    event: { providerEventId: "evt_success", type: "payment_intent.succeeded", providerCreatedAt: 200 },
  });
  assert.equal(succeeded.state.status, "succeeded");

  const staleFailure = applyStripePaymentEvent({
    current: succeeded.state,
    event: { providerEventId: "evt_old", type: "payment_intent.payment_failed", providerCreatedAt: 100 },
  });
  assert.equal(staleFailure.disposition, "ignored_stale");
  assert.equal(staleFailure.state.status, "succeeded");

  const laterProcessing = applyStripePaymentEvent({
    current: succeeded.state,
    event: { providerEventId: "evt_late", type: "payment_intent.processing", providerCreatedAt: 300 },
  });
  assert.equal(laterProcessing.disposition, "ignored_terminal");
  assert.equal(laterProcessing.state.status, "succeeded");
});

test("same-second payment events fail closed instead of depending on delivery order", () => {
  const current = applyStripePaymentEvent({
    current: null,
    event: { providerEventId: "evt_first", type: "payment_intent.processing", providerCreatedAt: 200 },
  }).state;
  const ambiguous = applyStripePaymentEvent({
    current,
    event: { providerEventId: "evt_second", type: "payment_intent.requires_action", providerCreatedAt: 200 },
  });
  assert.equal(ambiguous.disposition, "ignored_ambiguous_order");
  assert.deepEqual(ambiguous.state, current);
});

test("unconfigured runtime route fails closed", async () => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const { POST } = await import("../app/api/webhooks/stripe/route.js");
  const response = await POST(signedRequest(eventPayload()));
  assert.equal(response.status, 503);
  if (previous !== undefined) process.env.STRIPE_WEBHOOK_SECRET = previous;
});
