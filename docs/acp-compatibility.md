# ACP compatibility record

Status: pinned runtime checkout subset composed locally with durable repository ports; payment capabilities blocked.

This record describes only the local M2/M3 application boundary. It does not claim
provider, account, payment-handler, staging, or end-to-end payment compatibility.

## Pinned artifact

| Field | Verified value | Evidence |
| --- | --- | --- |
| API revision | `2026-04-17` | Required `API-Version` value and vendored OpenAPI/JSON Schema snapshot |
| Schema commit | `7fdd78df677a94dce04c770644b0fbbb1401272b` | `protocol/acp/manifest.json` and hash contract test |
| License/notices | Apache-2.0; retained upstream notices | Vendored `LICENSE` and `NOTICE` hashes |
| Authentication | Server-held bearer at the route boundary | `lib/acp/runtime/index.mjs` |

Artifact hashes prove that the repository snapshot matches the approved pin.
They do not prove that an account supports a handler, that a provider is
configured, or that a payment can be executed.

## Runtime routes

The application mounts the pinned operation paths below `/api/acp`:

| Operation | Local route | Runtime status |
| --- | --- | --- |
| Create checkout | `POST /api/acp/checkout_sessions` | Implemented behind admission flag |
| Retrieve checkout | `GET /api/acp/checkout_sessions/{checkoutSessionId}` | Implemented behind admission flag |
| Update checkout | `POST /api/acp/checkout_sessions/{checkoutSessionId}` | Implemented behind admission flag |
| Complete checkout | `POST /api/acp/checkout_sessions/{checkoutSessionId}/complete` | Contract pinned; always capability-blocked in M2 |
| Cancel checkout | `POST /api/acp/checkout_sessions/{checkoutSessionId}/cancel` | Implemented behind admission flag |
| Delegate payment | `POST /api/acp/agentic_commerce/delegate_payment` | Contract pinned; always capability-blocked in M2 |

Every request requires:

- `Authorization: Bearer <server-held token>`;
- `API-Version: 2026-04-17`;
- `PaymentLab-Session-Id` and `PaymentLab-Run-Id`, both matched to the authenticated server-side context;
- `Idempotency-Key` on every mutation; and
- `Content-Type: application/json` whenever a mutation body is present. The
  pinned cancel operation may omit its optional body.

Browser-originated requests are denied when `Sec-Fetch-Site` is `cross-site` or
when browser fetch metadata has no `Origin`; every supplied origin must be a
configured canonical HTTP(S) origin. Opaque `null` origins are always denied.
Server-to-server requests without browser origin headers remain eligible for
bearer authentication. Each response receives a server-generated request ID;
an inbound `Request-Id` is not trusted as the authoritative correlation ID.

## Application port

`configureAcpRuntimePort(port)` in `lib/application/acp-runtime.mjs` accepts an
injected application port. Route code imports no persistence, provider, Stripe,
or workflow implementation. The port methods are:

- `createCheckout({context,input,idempotencyKey,requestId,apiVersion})`
- `retrieveCheckout({context,checkoutSessionId,requestId,apiVersion})`
- `updateCheckout({context,checkoutSessionId,input,idempotencyKey,requestId,apiVersion})`
- `cancelCheckout({context,checkoutSessionId,input,idempotencyKey,requestId,apiVersion})`

The pinned but blocked methods are named `completeCheckout` and
`delegatePayment`. M2 route control flow never invokes either method, including
when their reserved environment flags are set to `true`.

`context` is exactly `{subject,sessionId,runId}`. A mutation result is
`{value,idempotentReplayed}` and a read result is `{value}`. The application port
owns durable idempotency: identical scope/key/payload returns the stable prior
result; a changed payload throws `new RuntimeError("idempotency_conflict")`.
All port responses are validated against the vendored response definitions
before serialization. The boundary additionally rejects every otherwise-valid
checkout response that advertises a payment handler.

### M3 local durable composition

`createLocalAcpApplicationPort({persistence})` in
`lib/application/local-acp-port.mjs` implements only create, retrieve, update,
and cancel. `createLocalAcpComposition({persistence})` returns that explicit port
without registering it globally, changing admission, reading environment
variables, opening a pool, or connecting at module import.

The injected M3 repository contract is transaction-scoped:

- `withTransaction(work)`
- `claimAcpIdempotency(tx, claim)` -> `created`, `replay` with the persisted
  response, or `conflict`
- `storeAcpIdempotentResponse(tx, record)` -> `stored`
- `createAcpCheckout`, `retrieveAcpCheckout`, `updateAcpCheckout`, and
  `cancelAcpCheckout`, each receiving subject/session/run/request/version scope
  and returning explicit status/checkout envelopes

Mutation scope and SHA-256 request hashes exclude the generated request ID, so a
retry with a new correlation ID replays the exact durable prior response. A
changed body conflicts. Repository access always includes subject, session, and
run; an opaque checkout ID alone is insufficient. Before returning, the
application port replaces any repository payment-handler list with `[]` and
validates the resulting response against the pinned vendored schema.

The composed port has no `completeCheckout` or `delegatePayment` methods. The
existing runtime hard blocks remain unchanged and execute before a payment
method lookup even when reserved flags are true.

## Validation and safe failures

Create, update, complete, cancel, and delegate-payment request definitions and
all six response definitions are pinned to the vendored schemas. Runtime-enabled
operations validate input before invoking the port and validate output before
returning it. When admission is enabled, blocked payment routes validate path,
idempotency, content type, size, JSON, and the pinned request schema, then return
`capability_blocked` before application-port invocation. Their unreachable
response definitions remain testable offline with `validateAcpPayload`.

All runtime errors serialize as exactly:

`{code,message,retryable,requestId}`

Unknown and provider-shaped exceptions map to a fixed `internal_error` message.
Exception messages, provider payloads, tokens, card values, and internal fields
are never copied into the response. Request bodies are stream-read with a 256
KiB ceiling. `idempotency_in_flight` responses include the pinned `Retry-After`
header.

## Capability and handler statement

No payment handler or discovery document is advertised. Checkout responses used
for M2 tests contain `capabilities.payment.handlers: []`, and the runtime rejects
non-empty handler lists from an injected port. Complete and delegated payment are
defense-in-depth blocked after safe request validation and before
application-port invocation. No Stripe/provider import or mutation exists in the
ACP route or runtime packages.

Accurate compatibility statement:

“PaymentLab implements an authenticated, run-scoped ACP `2026-04-17` checkout
contract subset for create, retrieve, update, and cancel. Complete and delegated
payment remain unavailable, and no payment handler is advertised.”

## Local evidence

`test/m2-acp-runtime.test.mjs` covers enabled synthetic success, all six pinned
contracts, malformed/unsupported input, version/auth/run ownership, mutation
idempotency, origin bounds, response validation, safe provider-shaped error
mapping, default-off admission, and unconditional no-payment capability blocks.
`test/acp-contract.test.mjs` verifies the pinned artifact set and hashes.

`test/m3-acp-composition.test.mjs` adds repository-fake evidence for transactional
CRUD, durable replay/conflict, cross-owner isolation, response validation, empty
handlers, missing/failing repository behavior, disabled admission, and unchanged
complete/delegate hard blocks.

This is local synthetic evidence only. It is not provider delivery, payment,
staging, QA, or release evidence.
