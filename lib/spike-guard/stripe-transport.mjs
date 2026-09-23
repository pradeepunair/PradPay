import { createHash } from "node:crypto";

const ENDPOINT = "https://api.stripe.com/v1/test_helpers/shared_payment/granted_tokens";
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;

function fingerprint(value) {
  if (typeof value !== "string" || !value) return null;
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function formBody(request) {
  return new URLSearchParams({
    payment_method: request.body.payment_method,
    "usage_limits[currency]": request.body.usage_limits.currency,
    "usage_limits[max_amount]": String(request.body.usage_limits.max_amount),
    "usage_limits[expires_at]": String(request.body.usage_limits.expires_at),
  });
}

export function createStripeGrantedTokenTransport({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  return async function sendGrantedTokenRequest({ request, credential, signal, authorizeSend } = {}) {
    if (!credential || typeof credential.secret !== "string" || !credential.secret) throw new Error("server-held test credential is unavailable");
    if (!(signal instanceof AbortSignal)) throw new Error("abort signal is required");
    if (typeof authorizeSend !== "function") throw new Error("send authorization callback is required");
    await authorizeSend();
    if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("action lease expired");

    try {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          Authorization: `Bearer ${credential.secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Stripe-Version": request.stripeApiVersion,
        },
        body: formBody(request),
      });
      const payload = await response.json();
      const statusClass = response.status >= 200 && response.status < 300
        ? "success"
        : response.status >= 300 && response.status < 400
          ? "redirect"
          : response.status >= 400 && response.status < 500
            ? "client_error"
            : response.status >= 500 && response.status < 600
              ? "server_error"
              : "invalid";
      const output = Object.freeze({
        statusClass,
        requestReference: fingerprint(response.headers.get("request-id")),
        objectClass: payload?.object === "shared_payment.granted_token"
          ? "granted_token"
          : payload?.object ? "other" : "missing",
        objectReference: fingerprint(payload?.id),
        hasError: Boolean(payload?.error),
      });
      if (!("success redirect client_error server_error invalid".split(" ").includes(output.statusClass))
        || (output.requestReference !== null && !FINGERPRINT_PATTERN.test(output.requestReference))
        || (output.objectReference !== null && !FINGERPRINT_PATTERN.test(output.objectReference))) {
        throw new Error("provider response projection is invalid");
      }
      return output;
    } catch {
      if (signal.aborted) throw new Error("action lease expired");
      throw new Error("capability request outcome is ambiguous; do not retry");
    }
  };
}

export const sendApprovedStripeGrantedTokenRequest = createStripeGrantedTokenTransport();
