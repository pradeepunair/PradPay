PaymentLab M3 local reliability runbook

Scope and authority

This package is local and synthetic only. It does not authorize Stripe or other provider calls, provider credentials, webhook destinations, hosted resources, deployment, DNS, payment, Live Sandbox, push, PR, or merge. PostgreSQL remains business truth. No module starts a server, worker, timer, or connection at import.

Interfaces

`createLocalSafetyController({persistence})`

Required transaction ports:

- `withTransaction(work)`
- `readSafetyControl(tx, {environment})` -> `{paymentAdmissionEnabled,version,reasonCode}` or null
- `reserveSyntheticBudget(tx, claim)` -> `{status:"reserved"|"replay"|"conflict"|"kill_switch"|"budget_exhausted",record?}`
- reliability-shaped `createOutboxJob(tx, job)` for the existing unknown-attempt reconciliation action

Methods:

- `admitSynthetic(claim)` reads the durable control and reserves budget in one transaction. Missing control, disabled admission, ambiguous/invalid adapter response, or adapter exception fails closed.
- `executeSynthetic({claim,provider,onCallback?})` invokes `provider.execute` only after `reserved` or `replay`. Kill, budget exhaustion, conflict, and adapter failure produce zero provider invocations. A synthetic unknown result preserves the same scoped operation/attempt and immediately schedules the dedupe-keyed reconciliation job before returning `status:"unknown"`; it never creates a replacement attempt.
- `permitExistingReconciliation(operation)` permits only a scoped existing `unknown` operation/attempt and explicitly forbids a replacement attempt. It does not read admission state, so disabling new admission cannot strand prior ambiguous work.

Claims require environment, session/run, stable operation/attempt/idempotency identifiers, lowercase SHA-256 request hash, and non-negative integer minor units. The data adapter owns atomic row locks/counters and concurrency enforcement.

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

`createLocalWebhookComposition({pool,endpointSecret,applyBusinessEvent,...})`

The factory requires:

- injected pg-compatible `pool.connect`;
- a server-held local endpoint signing secret value supplied by the integration owner at composition time;
- mandatory `applyBusinessEvent(tx,safeEvent)` callback;
- default or injected event/reference allowlist controls.

It explicitly composes `createPostgresPersistence`, `createReliabilityPersistenceAdapter`, `createStripeWebhookReceiptService`, and `createStripeWebhookPost`. Construction does not connect. The first request opens the transaction. Verification operates on untouched bytes with the accepted 300-second tolerance before parse. The receipt is persisted before the allowlisted mutation, both in one transaction, and acknowledgement occurs only after commit.

Unknown event types are durably received and ignored. For supported events, the local verification wrapper also requires the expected allowlisted `data.object.object` type before the receipt service can classify the event for business application; a mismatched object type is converted to an ignored local disposition after signature verification. Unsupported provider-reference shapes are durably received but cannot reach state mutation. The injected business callback must resolve the opaque provider reference to an authorized session/run record inside the supplied transaction before changing state; an opaque provider reference alone is never authorization.

Failure behavior

- Missing pool, secret, callback, or allowlist control: composition throws before serving.
- Missing/stale/invalid signature or live-mode event: fail closed under the accepted receipt service.
- Receipt persistence error: rollback and HTTP 503; no acknowledgement or state mutation.
- Business callback error: receipt and mutation roll back together; HTTP 503.
- Duplicate verified provider event: acknowledgement reports duplicate and skips business mutation.
- Safety adapter failure: safe `adapter_failure`; no exception detail and no synthetic call.
- Kill/budget/conflict: durable refusal result; no synthetic call and no replacement attempt.
- Unknown existing attempt: preserve attempt and authority holds; schedule one dedupe-keyed `reconcile:<attemptId>` outbox action through `scheduleUnknownOutcomeReconciliation`.

Observability

Safe local telemetry may record environment, session/run IDs, operation/attempt IDs, scenario, safe outcome/status, reservation status, callback/event ID, and reason/error code. Never record raw callback bodies, signatures, signing secret, request hash, idempotency key, reusable payment values, database URL, exception message, or stack trace. Hash any dedupe identifier before exporting it beyond restricted diagnostics.

Recovery traces

Ambiguous response after effect:

1. Keep the original operation and attempt `unknown`.
2. Do not release authority or create a replacement attempt.
3. Schedule `reconcile:<attemptId>` once.
4. Replay the same synthetic identity. The adapter returns/reports the original effect ID and emits the same event ID; reducer/business dedupe prevents a second effect.

Kill switch during recovery:

1. Disabled admission prevents all new budget reservations/provider invocations.
2. Existing unknown attempts remain eligible for reconciliation.
3. Verified receipts continue through local webhook composition.
4. Preserve receipts, attempts, events, reconciliation state, and outbox jobs.

Rollback and disable

Disable local payment admission and stop callers from invoking the synthetic adapter. Preserve all existing durable records and allow verified receipt intake plus existing reconciliation to continue. Code rollback must remain compatible with additive M3 schema. Any database down migration is disposable-test-only and data-owner controlled. Do not delete unresolved records to recover service.

Local verification

    node --test --test-reporter=spec test/m3-reliability-*.test.mjs
    npm test
    npx tsc --noEmit
    npm run docs:phases:check
    npm run build

Static tests verify the synthetic provider has no imports/network/provider SDK/timers/process capability, local composition imports only accepted local factories, and Stripe usage remains the static webhook verification utility without mutation methods.
