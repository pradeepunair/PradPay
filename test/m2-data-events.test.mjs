import assert from "node:assert/strict";
import test from "node:test";

import { assertSafeEventPayload } from "../lib/events/safe-payload.mjs";

test("safe event payloads accept JSON values and reject sensitive fields", () => {
  const payload = { checkoutId: "chk_demo", company: "Fictional Co", amountMinor: 30319, nested: [true, null] };
  assert.equal(assertSafeEventPayload(payload), payload);
  for (const unsafe of [
    { authorization: "Bearer example" },
    { raw_payload: "provider body" },
    { rawPayload: "provider body" },
    { payment_token: "reusable" },
    { nested: { paymentToken: "reusable" } },
    { nested: { apiKey: "not-allowed" } },
    { nested: { token: "not-allowed" } },
    { nested: { merchantPrivateCost: 123 } },
    { nested: { card_number: "not-allowed" } },
  ]) assert.throws(() => assertSafeEventPayload(unsafe), /not permitted/);
  for (const unsafe of [
    { note: "Bearer example.reusable.credential" },
    { value: "4111 1111 1111 1111" },
    { data: "tok_reusableExample" },
    { description: "embedded token: tok_reusableExample" },
    { description: "api-key=opaqueCredentialValue" },
    { description: "eyJhbGciOiJIUzI1NiJ9.payload.signature" },
  ]) assert.throws(() => assertSafeEventPayload(unsafe), /credential-shaped/);
});

test("safe event payloads reject non-JSON values and excessive nesting", () => {
  assert.throws(() => assertSafeEventPayload({ bytes: Buffer.from("x") }), /JSON-compatible/);
  assert.throws(() => assertSafeEventPayload({ amount: Number.NaN }), /finite/);
  assert.throws(() => assertSafeEventPayload({ amount: Number.POSITIVE_INFINITY }), /finite/);
  let nested = {};
  for (let index = 0; index < 14; index += 1) nested = { nested };
  assert.throws(() => assertSafeEventPayload(nested), /maximum nesting depth/);
});
