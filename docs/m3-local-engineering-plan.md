PaymentLab AI — M3 local synthetic engineering plan

Status: approved for local-only synthetic implementation
Baseline: f50d896ee5f6dfcca1a0b0020f1d0f8fc34eaea4
Branch/worktree: feat/m3-local-synthetic at /Users/pradeepnair/Documents/GitHub/PRADPAY-m3-local
Integration owner: Emily
Product input: docs/product/paymentlab-ai-m3-readiness.md, M3.0-readiness

Authority boundary

This work is limited to local source, deterministic synthetic adapters, and disposable PostgreSQL databases in the existing `paymentlab-postgres` container. It must not call Stripe or another provider, use or rotate credentials, create a webhook destination, deploy, provision/mutate hosted resources, change DNS, enable Live Sandbox, process a payment, push, open a PR, or merge.

The two untracked Product records inherited into this worktree are owner artifacts and are not package-owned files:

- docs/product/paymentlab-ai-m2-acceptance.md
- docs/product/paymentlab-ai-m3-readiness.md

Specialists and integration must preserve them without editing, deleting, staging, or claiming them as implementation commits.

Objective

Create the local, non-provider controls and composition required before any future hosted or Stripe gate:

1. Durable, default-closed payment-admission kill switch.
2. Atomic local synthetic budget reservation and durable reconciliation-control state in disposable PostgreSQL.
3. Deterministic synthetic provider outcomes and failure timing with no network capability.
4. Explicit local webhook composition using an injected pg-compatible pool, the accepted persistence/reliability adapter, and a mandatory allowlisted `applyBusinessEvent(tx, safeEvent)` callback.
5. Durable non-payment ACP create/retrieve/update/cancel application composition.
6. Preserve hard code blocks for complete/delegate-payment and advertise no handler.

Architecture and dependency order

PostgreSQL remains business truth. Data establishes additive schema and transaction-scoped ports. Reliability consumes those ports for admission, synthetic provider behavior, webhook composition, and reconciliation. Application consumes scoped repository ports for ACP checkout CRUD. Emily integrates all three, owns any manifest/dependency decision, cross-package tests, and the exact candidate.

No service starts a worker, timer, server, or provider client automatically. Composition is explicit through factories and dependency injection. Every externally consequential interface remains incapable of a real provider call in this milestone.

Shared safety invariants

- Payment admission defaults disabled on missing rows, missing configuration, adapter failure, or ambiguity.
- A kill switch blocks new synthetic attempt reservation but never blocks verified webhook receipt processing or reconciliation of already-recorded attempts.
- Budgets use integer minor units and database transactions/row locks. Concurrent claims must not exceed configured count or amount ceilings.
- Budget reservation is stable by operation/attempt key. An identical replay returns the original decision; a changed request conflicts.
- Refused or budget-exhausted admission creates no provider invocation and no replacement attempt.
- Unknown synthetic outcomes preserve the existing attempt and schedule one dedupe-keyed reconciliation action.
- All records are scoped by session/run where applicable; opaque IDs alone never authorize access.
- Raw webhook bodies, signatures, credentials, reusable payment values, and exception text are not persisted in safe records or telemetry.
- Complete and delegate-payment remain blocked in `lib/acp/runtime/index.mjs` before application-port invocation regardless of flags.
- Checkout responses contain no payment handler advertisement.

Data contract — M3-DATA-001

Owner: data-platform-engineer

Owned paths:

- db/migrations/202609190001_m3_local_safety_controls/**
- lib/persistence/postgres.mjs
- lib/persistence/pg-pool.mjs if needed
- test/m3-data-*.test.mjs
- bounded M3 additions to docs/data-model.md and docs/data-flow.md

Required additive records and methods:

- A durable environment-scoped safety-control record with payment admission default false, monotonic version, safe reason code, and update timestamp.
- Durable budget policy/counter records with integer `maximum_amount_minor`, attempt ceiling, UTC window, consumed amount/count, and explicit scope.
- Stable budget reservation/admission records keyed by operation/attempt identity and request hash.
- Durable reconciliation-control metadata sufficient to retain unknown attempts while admission is disabled.
- Transaction-scoped persistence methods with explicit result envelopes:
  - `readSafetyControl(tx, {environment})` -> `{paymentAdmissionEnabled,version,reasonCode}`; missing is disabled.
  - `setSafetyControl(tx, {environment,paymentAdmissionEnabled,expectedVersion,reasonCode})` -> updated record or version conflict.
  - `reserveSyntheticBudget(tx, claim)` -> `{status:"reserved"|"replay"|"conflict"|"kill_switch"|"budget_exhausted", record?}`.
  - Scoped ACP repository methods required by M3-APP-001 for create/read/update/cancel, always including `sessionId` and `runId` and transaction context.
- A pg-compatible pool factory may consume only a server-held local `PAYMENTLAB_DATABASE_URL`; missing/malformed configuration fails closed. It must not print connection data or connect at module import.

Data tests:

- Empty apply/repeatability, schema/constraint/index inspection, disposable down/reapply, and cleanup.
- Missing-control default disabled; optimistic control-version conflict.
- Concurrent budget reservations cannot exceed count or amount ceilings.
- Replay and changed-hash conflict behavior.
- Kill switch blocks a new reservation while reconciliation records remain readable/updatable.
- Session/run ownership and ACP repository isolation.
- Use only the existing container-configured role/database mechanism; never assume or create role `postgres`.

Reliability contract — M3-REL-001

Owner: integrations-reliability-engineer

Owned paths:

- lib/safety/**
- lib/payments/synthetic-provider.mjs or lib/payments/synthetic/**
- lib/composition/local-webhook.mjs
- bounded additions under lib/reconciliation/**
- test/m3-reliability-*.test.mjs
- docs/m3-local-reliability-runbook.md

Required services:

1. `createLocalSafetyController({persistence})`
   - Reads and reserves through the data transaction ports.
   - New synthetic work fails closed on kill switch, exhausted budget, conflicts, or adapter failure.
   - Reconciliation of an existing unknown attempt remains permitted when admission is disabled.

2. `createSyntheticPaymentProvider({scenario})`
   - No imports capable of network/provider access.
   - Allowlisted deterministic scenarios only: `succeeded`, `declined`, `requires_action`, `timeout_before_effect`, `timeout_after_effect`, `callback_before_response`, and `duplicate_callback`.
   - Requires stable operation/attempt/idempotency identity.
   - `timeout_after_effect` records one synthetic effect then reports unknown; retries replay the same result and never create another effect.
   - Produces sanitized test-mode safe events only.

3. `createLocalWebhookComposition({pool,endpointSecret,applyBusinessEvent,...})`
   - Requires an injected pg-compatible pool; no implicit global pool and no connection at import.
   - Composes `createPostgresPersistence`, `createReliabilityPersistenceAdapter`, `createStripeWebhookReceiptService`, and `createStripeWebhookPost`.
   - Requires a mandatory allowlisted `applyBusinessEvent(tx,safeEvent)` callback. Unknown event/object types are ignored safely; provider references are scoped before state mutation.
   - Missing pool, secret, callback, or unsupported composition fails closed.
   - Verification remains local with generated signatures and synthetic `livemode:false` events only.

4. Reconciliation controls
   - Preserve one existing attempt through unknown outcomes.
   - Schedule one dedupe-keyed reconciliation action.
   - Demonstrate kill switch stops new admission but not existing reconciliation.

Reliability tests:

- Every synthetic scenario; deterministic replay; no second effect after ambiguous response.
- Kill/budget/refusal yields zero synthetic provider calls.
- Callback-before-response convergence, duplicate callback, out-of-order protection.
- Local webhook composition performs verification, durable receipt, and allowlisted business mutation in one transaction.
- Persistence failure returns 503/no acknowledgement.
- Static import test proves synthetic provider/composition has no Stripe mutation/client or network modules.

Application contract — M3-APP-001

Owner: application-engineer

Owned paths:

- lib/application/local-acp-port.mjs
- lib/composition/local-acp.mjs
- bounded non-payment route/bootstrap additions under lib/application/** only
- test/m3-acp-composition.test.mjs
- bounded updates to docs/acp-compatibility.md and docs/acp-feature-flags.md

Required composition:

- `createLocalAcpApplicationPort({persistence})` implements only:
  - `createCheckout`
  - `retrieveCheckout`
  - `updateCheckout`
  - `cancelCheckout`
- Every operation uses `{subject,sessionId,runId}`, exact ACP version `2026-04-17`, generated request ID, and durable transaction/idempotency ports.
- Same mutation scope/key/request replays the exact prior response; changed payload conflicts.
- Cross-session/run access returns safe not-found/forbidden behavior without leakage.
- Responses validate against vendored schemas and always advertise `capabilities.payment.handlers: []`.
- The composed port must not expose or implement `completeCheckout` or `delegatePayment`.
- Existing runtime hard blocks for complete/delegate-payment must remain unchanged or become stricter; reserved flags cannot reach application code.
- Composition is explicit through a local factory and does not auto-enable admission or read credentials at import.

Application tests:

- Durable create/retrieve/update/cancel success and idempotent replay through scoped repository fakes/adapter contracts.
- Changed payload conflict and cross-owner isolation.
- Response-schema validation and empty payment handler list.
- Complete/delegate-payment cannot invoke the composed port even with reserved flags true.
- Missing pool/repository or disabled admission fails closed.

Integration-owned work

Emily owns:

- Any `package.json`/lockfile dependency change for a reviewed pg-compatible pool implementation.
- Cross-package adapter reconciliation and `test/m3-integration-*.test.mjs`.
- Preservation/inclusion decision for Product records and generated `next-env.d.ts`; specialists must not touch them.
- Full migration, regression, security, type, docs, and build evidence.
- One clean exact local candidate and consolidated report.

Acceptance evidence

The integrated candidate must prove:

- Local baseline regressions remain green.
- Additive migration apply/repeat/down/reapply on disposable PostgreSQL and zero disposable DBs afterward.
- Atomic concurrent kill-switch/budget behavior.
- Reconciliation continuity while admission is disabled.
- Deterministic synthetic faults and exactly one synthetic business effect.
- Concrete local webhook composition with generated signatures and no provider calls.
- Concrete non-payment ACP CRUD composition with durable ownership/idempotency.
- Complete/delegate-payment hard-blocked and no handler advertised.
- No imports or runtime paths capable of external payment/provider calls in the new M3 packages.
- `npm test`, focused M3 tests, `npx tsc --noEmit`, docs validation, build, secret scan, diff check, exact HEAD, and clean implementation state.

Rollback

Unset/disable local admission, stop synthetic dispatcher invocation, and preserve receipts, attempts, reconciliation state, events, and outbox jobs. Code rollback must remain schema-compatible. The M3 down migration is disposable-test-only. No owner/hosted database rollback or data deletion is authorized.

Remaining gates after local completion

Local completion does not satisfy or authorize authenticated Stripe capability, ADR-0003 acceptance, credential rotation/use, stable deployed callback, signing-secret custody, webhook destination, hosted database/workflow evidence, payment-handler enablement, test payment, deployment, Live Sandbox, protected-branch merge, or production promotion.
