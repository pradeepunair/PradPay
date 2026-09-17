import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";

import { POST } from "../app/api/webhooks/stripe/route.js";

const stripe = new Stripe("webhook-test-only");
const endpointSecret = "local_signing_secret_for_tests";

function eventPayload(overrides = {}) {
  return JSON.stringify({
    id: "evt_phase0_fixture",
    object: "event",
    created: 1788920000,
    livemode: false,
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_phase0_fixture", object: "payment_intent" } },
    ...overrides,
  });
}

function signedRequest(payload, secret = endpointSecret) {
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: Math.floor(Date.now() / 1000),
  });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
  });
}

test("accepts a signed supported test-mode event", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = endpointSecret;
  const response = await POST(signedRequest(eventPayload()));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, disposition: "received" });
});

test("rejects a mutated raw request body", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = endpointSecret;
  const payload = eventPayload();
  const request = signedRequest(payload);
  const mutatedRequest = new Request(request.url, {
    method: "POST",
    body: `${payload}\n`,
    headers: request.headers,
  });
  const response = await POST(mutatedRequest);
  assert.equal(response.status, 400);
});

test("rejects live-mode events even with a valid signature", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = endpointSecret;
  const response = await POST(signedRequest(eventPayload({ livemode: true })));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Live-mode Stripe events are not accepted." });
});

test("acknowledges but ignores a signed unneeded event", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = endpointSecret;
  const response = await POST(signedRequest(eventPayload({ type: "charge.updated" })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, disposition: "ignored" });
});

test("fails closed when the endpoint signing secret is absent", async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const response = await POST(signedRequest(eventPayload()));
  assert.equal(response.status, 503);
});
