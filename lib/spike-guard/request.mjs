import { createHash } from "node:crypto";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("request contains a non-plain object");
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key))) {
      throw new TypeError("request contains a non-canonical key");
    }
    const result = {};
    for (const key of keys.sort()) result[key] = canonicalize(value[key]);
    return result;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("request contains a non-finite number");
    return value;
  }
  if (["string", "boolean"].includes(typeof value) || value === null) return value;
  throw new TypeError("request contains a non-canonical value");
}

export function canonicalRequestHash(request) {
  const bytes = JSON.stringify(canonicalize(request));
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

export const FROZEN_SPIKE_REQUEST = deepFreeze({
  account: "acct_1UDULUFDhOfb5F0F",
  profile: "PradPay sandbox",
  method: "POST",
  path: "/v1/test_helpers/shared_payment/granted_tokens",
  stripeApiVersion: "2026-08-26.dahlia",
  acpVersion: "2026-04-17",
  capability: "shared_payment_granted_token_test_helper",
  body: {
    payment_method: "pm_1UIbCpFDhOfb5F0FVPrBIB0T",
    usage_limits: {
      currency: "usd",
      max_amount: 100,
      expires_at: 1790228100,
    },
  },
  effects: {
    paymentCount: 0,
    usdAmountMinor: 0,
  },
  transport: {
    maxAttempts: 1,
    retry: false,
    followRedirects: false,
    fallback: false,
    resubmit: false,
  },
});

export const APPROVED_REQUEST_HASH = "9b65d45d89ce5ad18eb6f1da316b89cbaba2ae4ea14566dfc5a6b863022b0f9f";
const computedRequestHash = canonicalRequestHash(FROZEN_SPIKE_REQUEST);
if (computedRequestHash !== APPROVED_REQUEST_HASH) {
  throw new Error("frozen spike request literals do not match the approved hash");
}
export const FROZEN_REQUEST_HASH = APPROVED_REQUEST_HASH;

export function assertExactSpikeRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("spike request must be an object");
  }
  if (canonicalRequestHash(request) !== FROZEN_REQUEST_HASH) {
    throw new Error("spike request does not match the frozen approval");
  }
  return FROZEN_SPIKE_REQUEST;
}
