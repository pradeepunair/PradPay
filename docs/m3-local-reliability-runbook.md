PaymentLab M3 local reliability runbook

Scope and authority

This package is local and synthetic only. It does not authorize Stripe or other provider calls, provider credentials, webhook destinations, hosted resources, deployment, DNS, payment, Live Sandbox, push, PR, or merge. PostgreSQL remains business truth. No module starts a server, worker, timer, or connection at import.

Authoritative product contract: `/Users/pradeepnair/Documents/GitHub/PRADPAY-m3-local/docs/product/paymentlab-ai-m3-readiness.md`, version `M3.1-readiness`. External gates and full M3 acceptance remain unauthorized.

Interfaces

`createLocalSafetyController({persistence})`

Construct the injected port with `createLocalSafetyPersistence({dataPersistence,outboxPersistence})`: `dataPersistence` is Dax's transaction-scoped PostgreSQL port and `outboxPersistence` is the accepted reliability adapter. This avoids sending reliability-shaped `{type,dedupeKey,...}` jobs directly to Dax's raw `{id,kind,...}` outbox method.

Required transaction ports:

- `withTransaction(work)`
- `readSafetyControl(tx, {environment})` -> `{paymentAdmissionEnabled,version,reasonCode}` or null
- `reserveSyntheticBudget(tx, claim)` -> `{status:"reserved"|"replay"|"conflict"|"kill_switch"|"budget_exhausted",record?}`
- `claimSyntheticPaymentAttempt(tx, {sessionId,runId,attemptId,operationId,requestHash})` -> `{status:"ready",attempt}` or `{status:"rejected"}`. The exact required response is `{status:"ready",attempt}` with `attempt.state==="submitted"` and matching `operationId`/`requestHash`. If anything else is returned the transaction aborts and admission yields `adapter_failure`. Kill-switch and conflict reservations skip the claim entirely.
- `markPaymentAttemptUnknown(tx, {sessionId,runId,attemptId,operationId})` marks only the matching `submitted`, `processing`, or already-`unknown` durable attempt unknown and returns `{status:"updated",attempt}`; terminal/mismatched attempts return `{status:"rejected"}`
- `readUnknownPaymentAttempt(tx, {sessionId,runId,attemptId})` returns only the matching durable unknown attempt
- `upsertReconciliationControl(tx, control)`; its scoped payment-attempt foreign key verifies the durable attempt before unknown-outcome scheduling
- `readReconciliationControl(tx, {sessionId,runId,attemptId})`; only a matching durable `pending` control authorizes existing-attempt scheduling
- reliability-shaped `createOutboxJob(tx, job)` for the existing unknown-attempt reconciliation action

Methods:

- `admitSynthetic(claim)` reads the durable control and always calls `reserveSyntheticBudget` in the same transaction after a successful control read. Missing/disabled control therefore records and replays Dax's durable `kill_switch` decision; a changed claim conflicts. If reserve returns `reserved` or `replay` the controller then calls `claimSyntheticPaymentAttempt` inside the same transaction. The exact required result is `{status:"ready",attempt}` with `attempt.state==="submitted"` and matching operation ID and request hash. A rejected claim aborts the transaction; admission yields `adapter_failure` (retryable). A control read failure, reservation failure, claim failure, or adapter exception fails closed.
- `executeSynthetic({claim,provider,onCallback?})` invokes `provider.execute` only after `reserved` or `replay`. Kill, budget exhaustion, conflict, and adapter failure produce zero provider invocations. A timeout or callback rejection after an effect becomes the stable unknown outcome, atomically marks and verifies the scoped durable attempt unknown, upserts its reconciliation control, and creates the dedupe-keyed outbox job; it never creates a replacement.
- `scheduleExistingReconciliation({sessionId,runId,attemptId})` requires both the matching durable unknown payment attempt and pending reconciliation control before scheduling. Caller-supplied status is ignored and cannot fabricate eligibility; terminal attempts are rejected. The path does not read admission state, so disabling new admission cannot strand prior ambiguous work.

Claims require environment, `admissionId`, `policyId`, session/run, stable operation/attempt/idempotency identifiers, lowercase SHA-256 request hash, and non-negative integer minor units. The controller maps `admissionId` to Dax's `id` and `operationId` to Dax's `operationKey`; the idempotency key remains the synthetic-provider identity. The data adapter owns atomic row locks/counters and concurrency enforcement.

`createSyntheticPaymentProvider({scenario})`

Allowlisted scenarios:

- `succeeded`
- `declined`
- `requires_action`
- `timeout_before_effect`
- `timeout_after_effect`
- `callback_before_response`
- `duplicate_callback`

`execute({operationId,attemptId,idempotencyKey,requestHash},{onCallback?})` requires stable opaque identities. Identical replay returns the same deterministic effect. Reusing the idempotency key with changed identity/hash throws a non-retryable conflict. `timeout_before_effect` reports unknown with zero effects. `timeout_after_effect` records exactly one effect, emits the same safe callback evidence on replay, and reports unknown without creating a replacement. Callback scenarios use a sanitized test-only event carrying no raw body, signature, credential, payment token, or private provider data.

The provider is an in-memory deterministic test adapter, not durable state. Its `inspect()` counters are test evidence only. It imports nothing and has no network, provider SDK, process, worker, or timer capability.

`reduceSyntheticPaymentEvent({current,event})` deduplicates by event ID and rejects stale, ambiguous same-time, and terminal-regression evidence.

`createLocalWebhookComposition({pool,endpointSecret,resolveProviderReference,applyBusinessEvent,...})`

The factory requires:

- injected pg-compatible `pool.connect`;
- a server-held local endpoint signing secret value supplied by the integration owner at composition time;
- mandatory transaction-scoped `resolveProviderReference(tx,safeEvent)` authorization callback returning `{authorized:true,sessionId,runId,...}`;
- mandatory `applyBusinessEvent(tx,safeEvent,authorization)` callback;
- an event-type allowlist plus fixed syntactic provider-reference and object-type checks.

It explicitly composes `createPostgresPersistence`, `createReliabilityPersistenceAdapter`, `createStripeWebhookReceiptService`, and `createStripeWebhookPost`. Construction does not connect. The first request opens the transaction. Verification operates on untouched bytes with the accepted 300-second tolerance before parse. The receipt is persisted before the allowlisted mutation, both in one transaction, and acknowledgement occurs only after commit.

Unknown event types are durably received and ignored. For supported events, the local verification wrapper also requires the expected allowlisted `data.object.object` type before the receipt service can classify the event for business application; a mismatched object type is converted to an ignored local disposition after signature verification. Unsupported provider-reference shapes are durably received but cannot reach state mutation. A syntactically valid opaque reference is passed to the mandatory resolver inside the receipt transaction; absent, unresolved, or failed authorization rolls back the receipt and returns HTTP 503 so callback-before-response races remain retryable. An opaque provider reference alone is never authorization.

Failure behavior

- Missing pool, secret, resolver, business callback, or event allowlist: composition throws before serving.
- Missing/stale/invalid signature or live-mode event: fail closed under the accepted receipt service.
- Receipt persistence error: rollback and HTTP 503; no acknowledgement or state mutation.
- Unresolved/failed provider-reference authorization: rollback *** HTTP 503; no acknowledgement or state mutation, allowing a later retry after the owning attempt commits.
- Business callback error: receipt and mutation roll back together; HTTP 503.
- Duplicate verified provider event: acknowledgement reports duplicate and skips business mutation.
- Safety adapter failure: safe `adapter_failure`; no exception detail and no synthetic call.
- Kill/budget/conflict: durable stable refusal result; identical kill-switch claims replay `kill_switch`, changed claims conflict, and no synthetic call or replacement attempt occurs.
- Unknown existing attempt: preserve attempt and authority holds; atomically record/verify its durable reconciliation control and schedule one dedupe-keyed `reconcile:<attemptId>` outbox action. Later scheduling requires a matching durable pending control and remains independent of admission state.

Observability

Safe local telemetry may record environment, session/run IDs, operation/attempt IDs, scenario, safe outcome/status, reservation status, callback/event ID, and reason/error code. Never record raw callback bodies, signatures, signing secret, request hash, idempotency key, reusable payment values, database URL, exception message, or stack trace. Hash any dedupe identifier before exporting it beyond restricted diagnostics.

Recovery traces

Ambiguous response after effect:

1. Atomically mark and verify the scoped original payment attempt `unknown` before creating reconciliation control/outbox work.
2. Do not release authority or create a replacement attempt.
3. Schedule `reconcile:<attemptId>` once.
4. Replay the same synthetic identity. The adapter returns/reports the original effect ID and emits the same event ID; reducer/business dedupe prevents a second effect.

Kill switch during recovery:

1. Disabled admission prevents all new budget reservations/provider invocations.
2. Existing unknown attempts remain eligible for reconciliation.
3. Verified receipts continue through local webhook composition.
4. Preserve receipts, attempts, events, reconciliation state, and outbox jobs.

Synthetic admission attempt claim

When reserveSyntheticBudget returns `reserved` or `replay`, the controller immediately calls `dataPersistence.claimSyntheticPaymentAttempt(tx, {sessionId,runId,attemptId,operationId,requestHash})` inside the same transaction. The exact required response is `{status:'ready',attempt}` with `attempt.state === 'submitted'` and matching operationId/requestHash. If the result is anything other than `status:'ready'`, or the returned attempt has a non-submitted state or mismatched identifiers, the transaction aborts and admission yields `adapter_failure` (retryable). This prevents a fresh reservation from being committed against an attempt that is terminal, already-unknown, or fabricated. Kill-switch and conflict reservations skip the claim entirely.

Reconciliation continuity after claim

A previously-admitted attempt replayed against a new claim sees the attempt in its last durable state. The claim step will see a non-submitted state or a mismatched identifier and reject, rolling back the reservation. The replay then falls back to the existing reconciliation path (if the attempt is unknown with a pending control) without creating a second provider call.

No-provider-call guarantee

The provider is invoked only after admitSynthetic returns `{admitted:true}` and the controller calls `provider.execute()`. The claim-synthesis step itself makes zero synthetic-provider calls. Any claim rejection rolls back the reservation without provider invocation.

Unknown replay no resubmission

When a previously-admitted attempt is replayed (e.g. a pending reconciliation control exists for that scope), the admission controller re-enters reserveSyntheticBudget. If the budget is still available, the claim step will see the attempt in its last durable state and reject, rolling back the reservation. The replay then falls back to the existing reconciliation path without creating a second provider call or second outbox job.

Rollback and disable

Disable local payment admission and stop callers from invoking the synthetic adapter. Preserve all existing durable records and allow verified receipt intake plus existing reconciliation to continue. Code rollback must remain compatible with additive M3 schema. Any database down migration is disposable-test-only and data-owner controlled. Do not delete unresolved records to recover service.

Local verification

    node --test --test-reporter=spec test/m3-reliability-*.test.mjs
    npm test
    npx tsc --noEmit
    npm run docs:phases:check
    npm run build

Static tests verify the synthetic provider has no imports/network/provider SDK/timers/process capability, local composition imports only accepted local factories, and Stripe usage remains the static webhook verification utility without mutation methods.