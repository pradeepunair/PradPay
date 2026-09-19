import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";

import {
  classifyStripeEvent,
  verifyStripeEvent,
} from "../lib/stripe-webhook.mjs";

const endpointSecret = "local_signing_secret_for_tests";
const receivedAt = 1_788_920_100_000;

function eventPayload(overrides = {}) {
  return JSON.stringify({
    id: "evt_phase0_fixture",
    object: "event",
    created: 1_788_920_000,
    livemode: false,
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_phase0_fixture", object: "payment_intent" } },
    ...overrides,
  });
}

function signatureFor(payload, secret = endpointSecret) {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: Math.floor(receivedAt / 1000),
  });
}

test("accepts a signed supported test-mode event", () => {
  const payload = eventPayload();
  const event = verifyStripeEvent({
    rawBody: Buffer.from(payload),
    signature: signatureFor(payload),
    endpointSecret,
    receivedAt,
  });
  assert.deepEqual(classifyStripeEvent(event), { accepted: true, disposition: "received" });
});

test("rejects a mutated raw request body", () => {
  const payload = eventPayload();
  assert.throws(() => verifyStripeEvent({
    rawBody: Buffer.from(`${payload}\n`),
    signature: signatureFor(payload),
    endpointSecret,
    receivedAt,
  }));
});

test("rejects live-mode events even with a valid signature", () => {
  const payload = eventPayload({ livemode: true });
  const event = verifyStripeEvent({
    rawBody: Buffer.from(payload),
    signature: signatureFor(payload),
    endpointSecret,
    receivedAt,
  });
  assert.deepEqual(classifyStripeEvent(event), {
    accepted: false,
    disposition: "rejected_live_mode",
  });
});

test("classifies a signed unneeded event as ignored", () => {
  const payload = eventPayload({ type: "charge.updated" });
  const event = verifyStripeEvent({
    rawBody: Buffer.from(payload),
    signature: signatureFor(payload),
    endpointSecret,
    receivedAt,
  });
  assert.deepEqual(classifyStripeEvent(event), { accepted: true, disposition: "ignored" });
});

test("fails closed when the endpoint signing secret is absent", () => {
  const payload = eventPayload();
  assert.throws(() => verifyStripeEvent({
    rawBody: Buffer.from(payload),
    signature: signatureFor(payload),
    endpointSecret: "",
    receivedAt,
  }), /secret is unavailable/);
});
