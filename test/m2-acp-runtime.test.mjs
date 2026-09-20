import assert from "node:assert/strict";
import test from "node:test";

import {
  ACP_VERSION,
  RuntimeError,
  createAcpRuntimeHandler,
  validateAcpPayload,
} from "../lib/acp/runtime/index.mjs";
import {
  configureAcpRuntimePort,
  resetAcpRuntimePort,
} from "../lib/application/acp-runtime.mjs";
import { POST as createRoute } from "../app/api/acp/checkout_sessions/route.js";
import { GET as retrieveRoute, POST as updateRoute } from "../app/api/acp/checkout_sessions/[checkoutSessionId]/route.js";
import { POST as cancelRoute } from "../app/api/acp/checkout_sessions/[checkoutSessionId]/cancel/route.js";
import { POST as completeRoute } from "../app/api/acp/checkout_sessions/[checkoutSessionId]/complete/route.js";
import { POST as delegatePaymentRoute } from "../app/api/acp/agentic_commerce/delegate_payment/route.js";

const token = "test-only-bearer";
const sessionId = "sess_alpha123";
const runId = "run_alpha123";
const checkoutId = "cs_alpha123";

function checkout(overrides = {}) {
  return {
    id: checkoutId,
    status: "ready_for_payment",
    currency: "usd",
    line_items: [],
    totals: [],
    fulfillment_options: [],
    messages: [],
    links: [],
    capabilities: { payment: { handlers: [] } },
    ...overrides,
  };
}

function createSyntheticPort() {
  const records = new Map([[checkoutId, checkout()]]);
  const idempotency = new Map();
  const calls = [];

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function mutate(operation, args, result) {
    calls.push({ operation, args });
    const target = args.checkoutSessionId ?? "collection";
    const scope = `${args.context.sessionId}:${args.context.runId}:${operation}:${target}:${args.idempotencyKey}`;
    const hash = stableJson(args.input ?? {});
    const prior = idempotency.get(scope);
    if (prior && prior.hash !== hash) throw new RuntimeError("idempotency_conflict");
    if (prior) return { ...prior.result, idempotentReplayed: true };
    const wrapped = { value: result, idempotentReplayed: false };
    idempotency.set(scope, { hash, result: wrapped });
    return wrapped;
  }

  return {
    calls,
    async createCheckout(args) {
      return mutate("create", args, checkout());
    },
    async retrieveCheckout(args) {
      calls.push({ operation: "retrieve", args });
      const value = records.get(args.checkoutSessionId);
      if (!value) throw new RuntimeError("not_found");
      return { value };
    },
    async updateCheckout(args) {
      return mutate("update", args, checkout({ status: "incomplete" }));
    },
    async cancelCheckout(args) {
      return mutate("cancel", args, checkout({ status: "canceled" }));
    },
    async completeCheckout(args) {
      calls.push({ operation: "complete", args });
      throw new Error("payment mutation must never be reached");
    },
    async delegatePayment(args) {
      calls.push({ operation: "delegate-payment", args });
      throw new Error("provider mutation must never be reached");
    },
  };
}

function makeHandler({
  port = createSyntheticPort(),
  flags = { admission: true, complete: false, delegatePayment: false },
  allowedOrigins = ["https://agent.example"],
  authenticate = async (presented) => presented === token
    ? { subject: "agent_1", sessionId, runIds: [runId] }
    : null,
} = {}) {
  let sequence = 0;
  return {
    port,
    handler: createAcpRuntimeHandler({
      port,
      flags,
      allowedOrigins,
      authenticate,
      createRequestId: () => `req_test_${++sequence}`,
    }),
  };
}

function request(method, path, body, headers = {}) {
  return new Request(`https://merchant.example${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "API-Version": ACP_VERSION,
      "PaymentLab-Session-Id": sessionId,
      "PaymentLab-Run-Id": runId,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const createBody = {
  line_items: [{ id: "item_1" }],
  currency: "usd",
  capabilities: {},
};

const completeBody = {
  payment_data: {
    handler_id: "fixture-handler",
    instrument: { type: "synthetic", credential: { type: "synthetic", token: "non-reusable-fixture" } },
  },
};

const delegateBody = {
  payment_method: { type: "card", card_number_type: "network_token", number: "non-reusable-fixture", display_card_funding_type: "credit", metadata: {} },
  allowance: { reason: "one_time", max_amount: 100, currency: "usd", checkout_session_id: checkoutId, merchant_id: "fixture", expires_at: "2030-01-01T00:00:00Z" },
  risk_signals: [],
  metadata: {},
};

async function bodyOf(response) {
  return JSON.parse(await response.text());
}

async function assertSafeError(response, expectedCode) {
  const body = await bodyOf(response);
  assert.equal(body.code, expectedCode);
  assert.deepEqual(Object.keys(body).sort(), ["code", "message", "requestId", "retryable"]);
  assert.match(body.requestId, /^req_/);
  assert.equal(typeof body.message, "string");
  assert.equal(typeof body.retryable, "boolean");
  return body;
}

test("implements create, retrieve, update, and cancel with pinned response validation", async () => {
  const { handler, port } = makeHandler();
  const cases = [
    ["create", request("POST", "/checkout_sessions", createBody, { "Idempotency-Key": "idem_create" })],
    ["retrieve", request("GET", `/checkout_sessions/${checkoutId}`)],
    ["update", request("POST", `/checkout_sessions/${checkoutId}`, { order_notes: "Leave at desk" }, { "Idempotency-Key": "idem_update" })],
    ["cancel", request("POST", `/checkout_sessions/${checkoutId}/cancel`, {}, { "Idempotency-Key": "idem_cancel" })],
  ];

  for (const [operation, incoming] of cases) {
    const response = await handler(incoming, { operation, checkoutSessionId: operation === "create" ? undefined : checkoutId });
    assert.equal(response.status, operation === "create" ? 201 : 200);
    assert.equal(response.headers.get("API-Version"), ACP_VERSION);
    assert.match(response.headers.get("Request-Id"), /^req_test_/);
    assert.equal((await bodyOf(response)).capabilities.payment.handlers.length, 0);
  }
  assert.equal(port.calls.length, 4);
});

test("requires exact API version and safe request IDs", async () => {
  const { handler } = makeHandler();
  const missing = request("GET", `/checkout_sessions/${checkoutId}`, undefined, { "API-Version": "" });
  await assertSafeError(await handler(missing, { operation: "retrieve", checkoutSessionId: checkoutId }), "unsupported_version");
  const wrong = request("GET", `/checkout_sessions/${checkoutId}`, undefined, { "API-Version": "2026-01-30", "Request-Id": "bad request id" });
  const response = await handler(wrong, { operation: "retrieve", checkoutSessionId: checkoutId });
  const error = await assertSafeError(response, "unsupported_version");
  assert.notEqual(error.requestId, "bad request id");
});

test("always generates the authoritative request ID instead of trusting a client value", async () => {
  const { handler } = makeHandler();
  const response = await handler(
    request("GET", `/checkout_sessions/${checkoutId}`, undefined, { "Request-Id": "req_client_spoof" }),
    { operation: "retrieve", checkoutSessionId: checkoutId },
  );
  assert.equal(response.status, 200);
  assert.notEqual(response.headers.get("Request-Id"), "req_client_spoof");
  assert.match(response.headers.get("Request-Id"), /^req_test_/);
});

test("rejects missing and invalid bearer authentication without calling the port", async () => {
  const { handler, port } = makeHandler();
  for (const authorization of ["", "Basic abc", "Bearer wrong"]) {
    const response = await handler(request("GET", `/checkout_sessions/${checkoutId}`, undefined, { Authorization: authorization }), { operation: "retrieve", checkoutSessionId: checkoutId });
    assert.equal(response.status, 401);
    await assertSafeError(response, "unauthorized");
  }
  assert.equal(port.calls.length, 0);
});

test("opaque checkout ID never authorizes cross-session or cross-run access", async () => {
  const { handler, port } = makeHandler();
  const crossSession = request("GET", `/checkout_sessions/${checkoutId}`, undefined, { "PaymentLab-Session-Id": "sess_other123" });
  const crossRun = request("GET", `/checkout_sessions/${checkoutId}`, undefined, { "PaymentLab-Run-Id": "run_other123" });
  await assertSafeError(await handler(crossSession, { operation: "retrieve", checkoutSessionId: checkoutId }), "forbidden");
  await assertSafeError(await handler(crossRun, { operation: "retrieve", checkoutSessionId: checkoutId }), "forbidden");
  assert.equal(port.calls.length, 0);
});

test("rejects malformed checkout, session, and run identifiers", async () => {
  const { handler, port } = makeHandler();
  const cases = [
    [request("GET", "/checkout_sessions/not-an-id"), "not-an-id"],
    [request("GET", `/checkout_sessions/${checkoutId}`, undefined, { "PaymentLab-Session-Id": "../session" }), checkoutId],
    [request("GET", `/checkout_sessions/${checkoutId}`, undefined, { "PaymentLab-Run-Id": "run_%2f" }), checkoutId],
  ];
  for (const [incoming, id] of cases) {
    await assertSafeError(await handler(incoming, { operation: "retrieve", checkoutSessionId: id }), "invalid_request");
  }
  assert.equal(port.calls.length, 0);
});

test("validates request fields against the pinned vendored schema", async () => {
  const { handler, port } = makeHandler();
  const response = await handler(request("POST", "/checkout_sessions", { ...createBody, provider_secret: "must-not-pass" }, { "Idempotency-Key": "idem_invalid" }), { operation: "create" });
  assert.equal(response.status, 400);
  await assertSafeError(response, "invalid_request");
  assert.equal(port.calls.length, 0);
});

test("rejects unsupported cancel fields even though the pinned schema omits additionalProperties", async () => {
  const { handler, port } = makeHandler();
  const response = await handler(
    request("POST", `/checkout_sessions/${checkoutId}/cancel`, { unsupported: true }, { "Idempotency-Key": "idem_cancel_invalid" }),
    { operation: "cancel", checkoutSessionId: checkoutId },
  );
  assert.equal(response.status, 400);
  await assertSafeError(response, "invalid_request");
  assert.equal(port.calls.length, 0);
});

test("requires idempotency on every mutation", async () => {
  const { handler, port } = makeHandler();
  const response = await handler(request("POST", "/checkout_sessions", createBody), { operation: "create" });
  assert.equal(response.status, 400);
  await assertSafeError(response, "idempotency_key_required");
  assert.equal(port.calls.length, 0);
});

test("same mutation is stable and changed payload conflicts through the port", async () => {
  const { handler } = makeHandler();
  const first = await handler(request("POST", "/checkout_sessions", createBody, { "Idempotency-Key": "idem_stable" }), { operation: "create" });
  const duplicate = await handler(request("POST", "/checkout_sessions", createBody, { "Idempotency-Key": "idem_stable" }), { operation: "create" });
  assert.deepEqual(await bodyOf(duplicate), await bodyOf(first));
  assert.equal(duplicate.headers.get("Idempotent-Replayed"), "true");
  const changed = await handler(request("POST", "/checkout_sessions", { ...createBody, currency: "eur" }, { "Idempotency-Key": "idem_stable" }), { operation: "create" });
  assert.equal(changed.status, 422);
  await assertSafeError(changed, "idempotency_conflict");
});

test("idempotency scope includes the target checkout and canonicalizes object keys", async () => {
  const { handler } = makeHandler();
  const key = { "Idempotency-Key": "idem_target_scope" };
  const first = await handler(request("POST", `/checkout_sessions/${checkoutId}`, { order_notes: "Desk", discounts: { codes: ["FIXTURE"] } }, key), { operation: "update", checkoutSessionId: checkoutId });
  const reordered = await handler(request("POST", `/checkout_sessions/${checkoutId}`, { discounts: { codes: ["FIXTURE"] }, order_notes: "Desk" }, key), { operation: "update", checkoutSessionId: checkoutId });
  const other = await handler(request("POST", "/checkout_sessions/cs_beta123", { discounts: { codes: ["FIXTURE"] }, order_notes: "Desk" }, key), { operation: "update", checkoutSessionId: "cs_beta123" });
  assert.equal(first.status, 200);
  assert.equal(reordered.headers.get("Idempotent-Replayed"), "true");
  assert.equal(other.status, 200);
  assert.equal(other.headers.get("Idempotent-Replayed"), null);
});

test("maps provider-shaped failures to an exact safe error without leakage", async () => {
  const providerFailure = Object.assign(new Error("provider account-private diagnostic"), {
    type: "ProviderOperationError",
    raw: { payment_reference: "provider-private" },
  });
  const port = createSyntheticPort();
  port.retrieveCheckout = async () => { throw providerFailure; };
  const { handler } = makeHandler({ port });
  const response = await handler(request("GET", `/checkout_sessions/${checkoutId}`), { operation: "retrieve", checkoutSessionId: checkoutId });
  assert.equal(response.status, 500);
  const body = await assertSafeError(response, "internal_error");
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("account-private"), false);
  assert.equal(serialized.includes("provider-private"), false);
  assert.equal(serialized.includes("ProviderOperationError"), false);
});

test("admission, complete, and delegate-payment flags default closed", async () => {
  const port = createSyntheticPort();
  const closed = makeHandler({ port, flags: {} }).handler;
  await assertSafeError(await closed(request("GET", `/checkout_sessions/${checkoutId}`), { operation: "retrieve", checkoutSessionId: checkoutId }), "capability_blocked");

  const { handler } = makeHandler({ port });
  await assertSafeError(await handler(request("POST", `/checkout_sessions/${checkoutId}/complete`, completeBody, { "Idempotency-Key": "idem_complete" }), { operation: "complete", checkoutSessionId: checkoutId }), "capability_blocked");
  await assertSafeError(await handler(request("POST", "/agentic_commerce/delegate_payment", delegateBody, { "Idempotency-Key": "idem_delegate" }), { operation: "delegate-payment" }), "capability_blocked");
  assert.equal(port.calls.some(({ operation }) => operation === "complete" || operation === "delegate-payment"), false);
});

test("complete and delegate-payment cannot reach the port even when reserved flags are true", async () => {
  const port = createSyntheticPort();
  const { handler } = makeHandler({ port, flags: { admission: true, complete: true, delegatePayment: true } });
  await assertSafeError(await handler(request("POST", `/checkout_sessions/${checkoutId}/complete`, completeBody, { "Idempotency-Key": "idem_complete_enabled" }), { operation: "complete", checkoutSessionId: checkoutId }), "capability_blocked");
  await assertSafeError(await handler(request("POST", "/agentic_commerce/delegate_payment", delegateBody, { "Idempotency-Key": "idem_delegate_enabled" }), { operation: "delegate-payment" }), "capability_blocked");
  assert.equal(port.calls.length, 0);
});

test("blocked payment surfaces still validate identifiers, idempotency, and pinned requests", async () => {
  const { handler, port } = makeHandler();
  await assertSafeError(await handler(request("POST", "/checkout_sessions/bad/complete", completeBody, { "Idempotency-Key": "idem_complete_bad_id" }), { operation: "complete", checkoutSessionId: "bad" }), "invalid_request");
  await assertSafeError(await handler(request("POST", `/checkout_sessions/${checkoutId}/complete`, completeBody), { operation: "complete", checkoutSessionId: checkoutId }), "idempotency_key_required");
  await assertSafeError(await handler(request("POST", `/checkout_sessions/${checkoutId}/complete`, {}, { "Idempotency-Key": "idem_complete_bad_body" }), { operation: "complete", checkoutSessionId: checkoutId }), "invalid_request");
  await assertSafeError(await handler(request("POST", "/agentic_commerce/delegate_payment", {}, { "Idempotency-Key": "idem_delegate_bad_body" }), { operation: "delegate-payment" }), "invalid_request");
  assert.equal(port.calls.length, 0);
});

test("pinned complete and delegate-payment request and response contracts validate offline", () => {
  const completeResponse = checkout({
    status: "completed",
    order: { id: "ord_alpha123", checkout_session_id: checkoutId, permalink_url: "https://example.invalid/orders/fixture" },
  });
  const delegateResponse = { id: "vt_fixture", created: "2030-01-01T00:00:00Z", metadata: {} };
  for (const [operation, direction, payload] of [
    ["complete", "request", completeBody],
    ["complete", "response", completeResponse],
    ["delegate-payment", "request", delegateBody],
    ["delegate-payment", "response", delegateResponse],
  ]) assert.deepEqual(validateAcpPayload(operation, direction, payload), { valid: true, errors: [] });
  assert.equal(validateAcpPayload("complete", "response", {}).valid, false);
  assert.equal(validateAcpPayload("delegate-payment", "response", {}).valid, false);
});

test("enforces conditional and order-independent uniqueness rules from the pinned schema", () => {
  const conditional = {
    ...completeBody,
    authentication_result: { outcome: "authenticated" },
  };
  assert.equal(validateAcpPayload("complete", "request", conditional).valid, false);

  const duplicateExtensions = checkout({
    capabilities: {
      payment: { handlers: [] },
      extensions: [
        { name: "discount", schema: "https://example.invalid/discount", spec: "https://example.invalid/spec" },
        { spec: "https://example.invalid/spec", schema: "https://example.invalid/discount", name: "discount" },
      ],
    },
  });
  assert.equal(validateAcpPayload("create", "response", duplicateExtensions).valid, false);
});

test("response validation prevents invalid port projections from escaping", async () => {
  const port = createSyntheticPort();
  port.retrieveCheckout = async () => ({ value: { id: checkoutId, internal_secret: "do-not-expose" } });
  const { handler } = makeHandler({ port });
  const response = await handler(request("GET", `/checkout_sessions/${checkoutId}`), { operation: "retrieve", checkoutSessionId: checkoutId });
  const body = await assertSafeError(response, "internal_error");
  assert.equal(JSON.stringify(body).includes("internal_secret"), false);
});

test("never advertises a schema-valid payment handler from an injected port", async () => {
  const port = createSyntheticPort();
  port.retrieveCheckout = async () => ({
    value: checkout({
      capabilities: {
        payment: {
          handlers: [{
            id: "fixture-handler",
            name: "dev.paymentlab.fixture",
            version: "2026-04-17",
            spec: "https://example.invalid/payment-handler",
            requires_delegate_payment: false,
            requires_pci_compliance: false,
            psp: "fixture-only",
            config_schema: "https://example.invalid/config-schema",
            instrument_schemas: ["https://example.invalid/instrument-schema"],
            config: {},
          }],
        },
      },
    }),
  });
  const { handler } = makeHandler({ port });
  await assertSafeError(await handler(request("GET", `/checkout_sessions/${checkoutId}`), { operation: "retrieve", checkoutSessionId: checkoutId }), "capability_blocked");
});

test("rejects cross-origin browser requests and permits configured same-origin requests", async () => {
  const { handler, port } = makeHandler();
  const blocked = request("GET", `/checkout_sessions/${checkoutId}`, undefined, { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" });
  await assertSafeError(await handler(blocked, { operation: "retrieve", checkoutSessionId: checkoutId }), "forbidden_origin");
  const allowed = request("GET", `/checkout_sessions/${checkoutId}`, undefined, { Origin: "https://agent.example", "Sec-Fetch-Site": "same-site" });
  assert.equal((await handler(allowed, { operation: "retrieve", checkoutSessionId: checkoutId })).status, 200);
  assert.equal(port.calls.length, 1);
});

test("rejects opaque origins and browser fetch metadata without an Origin", async () => {
  const { handler, port } = makeHandler({ allowedOrigins: ["null"] });
  await assertSafeError(await handler(request("GET", `/checkout_sessions/${checkoutId}`, undefined, { Origin: "null", "Sec-Fetch-Site": "same-origin" }), { operation: "retrieve", checkoutSessionId: checkoutId }), "forbidden_origin");
  await assertSafeError(await handler(request("GET", `/checkout_sessions/${checkoutId}`, undefined, { "Sec-Fetch-Site": "same-origin" }), { operation: "retrieve", checkoutSessionId: checkoutId }), "forbidden_origin");
  assert.equal(port.calls.length, 0);
});

test("rejects invalid JSON and non-JSON mutation content", async () => {
  const { handler, port } = makeHandler();
  const invalidJson = new Request("https://merchant.example/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "API-Version": ACP_VERSION,
      "PaymentLab-Session-Id": sessionId,
      "PaymentLab-Run-Id": runId,
      "Idempotency-Key": "idem_json",
      "Content-Type": "application/json",
    },
    body: "{",
  });
  await assertSafeError(await handler(invalidJson, { operation: "create" }), "invalid_request");
  await assertSafeError(await handler(request("POST", "/checkout_sessions", createBody, { "Idempotency-Key": "idem_type", "Content-Type": "text/plain" }), { operation: "create" }), "invalid_request");
  await assertSafeError(await handler(request("POST", "/checkout_sessions", createBody, { "Idempotency-Key": "idem_json_prefix", "Content-Type": "application/jsonp" }), { operation: "create" }), "invalid_request");
  assert.equal(port.calls.length, 0);
});

test("accepts the pinned bodyless cancel request", async () => {
  const { handler } = makeHandler();
  const response = await handler(
    request("POST", `/checkout_sessions/${checkoutId}/cancel`, undefined, { "Idempotency-Key": "idem_cancel_bodyless" }),
    { operation: "cancel", checkoutSessionId: checkoutId },
  );
  assert.equal(response.status, 200);
});

test("adds Retry-After for an idempotency request still in flight", async () => {
  const port = createSyntheticPort();
  port.createCheckout = async () => { throw new RuntimeError("idempotency_in_flight"); };
  const { handler } = makeHandler({ port });
  const response = await handler(request("POST", "/checkout_sessions", createBody, { "Idempotency-Key": "idem_in_flight" }), { operation: "create" });
  assert.equal(response.status, 409);
  assert.match(response.headers.get("Retry-After"), /^\d+$/);
  await assertSafeError(response, "idempotency_in_flight");
});

test("actual Next route modules use server-held scope, exact flags, and the injected port", async (t) => {
  const names = [
    "ACP_RUNTIME_ADMISSION_ENABLED",
    "ACP_RUNTIME_BEARER_TOKEN",
    "ACP_RUNTIME_SUBJECT",
    "ACP_RUNTIME_SESSION_ID",
    "ACP_RUNTIME_RUN_IDS",
    "ACP_ALLOWED_ORIGINS",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => {
    resetAcpRuntimePort();
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });

  Object.assign(process.env, {
    ACP_RUNTIME_ADMISSION_ENABLED: "true",
    ACP_RUNTIME_BEARER_TOKEN: token,
    ACP_RUNTIME_SUBJECT: "agent_1",
    ACP_RUNTIME_SESSION_ID: sessionId,
    ACP_RUNTIME_RUN_IDS: runId,
    ACP_ALLOWED_ORIGINS: "https://agent.example,null,not-an-origin",
  });
  const port = createSyntheticPort();
  configureAcpRuntimePort(port);
  const context = { params: Promise.resolve({ checkoutSessionId: checkoutId }) };
  const cases = [
    [createRoute, request("POST", "/api/acp/checkout_sessions", createBody, { "Idempotency-Key": "route_create" }), undefined, 201],
    [retrieveRoute, request("GET", `/api/acp/checkout_sessions/${checkoutId}`), context, 200],
    [updateRoute, request("POST", `/api/acp/checkout_sessions/${checkoutId}`, { order_notes: "Route test" }, { "Idempotency-Key": "route_update" }), context, 200],
    [cancelRoute, request("POST", `/api/acp/checkout_sessions/${checkoutId}/cancel`, undefined, { "Idempotency-Key": "route_cancel" }), context, 200],
  ];
  for (const [route, incoming, routeContext, status] of cases) {
    const response = await route(incoming, routeContext);
    assert.equal(response.status, status);
  }
  await assertSafeError(await completeRoute(request("POST", `/api/acp/checkout_sessions/${checkoutId}/complete`, completeBody, { "Idempotency-Key": "route_complete" }), context), "capability_blocked");
  await assertSafeError(await delegatePaymentRoute(request("POST", "/api/acp/agentic_commerce/delegate_payment", delegateBody, { "Idempotency-Key": "route_delegate" })), "capability_blocked");
  assert.equal(port.calls.length, 4);

  process.env.ACP_RUNTIME_ADMISSION_ENABLED = "TRUE";
  await assertSafeError(await retrieveRoute(request("GET", `/api/acp/checkout_sessions/${checkoutId}`), context), "capability_blocked");
  process.env.ACP_RUNTIME_ADMISSION_ENABLED = "true";
  resetAcpRuntimePort();
  await assertSafeError(await retrieveRoute(request("GET", `/api/acp/checkout_sessions/${checkoutId}`), context), "service_unavailable");
});
