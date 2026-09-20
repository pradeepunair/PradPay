PaymentLab M2 reliability runbook

Scope

This runbook covers the local fail-closed Stripe receipt boundary, unknown-outcome reconciliation, transactional outbox dispatcher, and deterministic workflow fake. It does not authorize a provider call, credential operation, hosted worker, deployment, payment, or Live Sandbox admission.

Composition and default safety

- `app/api/webhooks/stripe/route.js` exports `createStripeWebhookPost({receiptService, endpointSecret})`.
- The exported `POST` remains fail-closed with HTTP 503 until Emily composes the data-owned persistence adapter. It never acknowledges into memory.
- Compose `createStripeWebhookReceiptService({persistence, applyBusinessEvent})` with the fixed persistence port. The handler is mandatory; construction fails closed when it is absent. `applyBusinessEvent(tx, safeEvent)` must update business state in the same transaction as `recordWebhookReceipt`.
- Endpoint signing material remains server-held under the existing `STRIPE_WEBHOOK_SECRET` reference. Never print or persist its value.
- No module in this package constructs a Stripe API resource or invokes a mutation. The Stripe SDK is used only for local signature verification.

Persistence integration shapes

The services retain the fixed method names from `docs/m2-engineering-plan.md` and require these result envelopes:

- `recordWebhookReceipt(tx, receipt)` -> `{status: "created"|"duplicate", receipt?}`.
- `claimIdempotency(tx, claim)` -> `{status: "created"|"replay"|"conflict", record?}`. The injected `createOperation(tx, {claim, idempotency})` must persist the stable operation in the same transaction; the injected `readOperation(tx, {claim, idempotency})` must return it on replay. Both callbacks are mandatory so an immutable persistence record does not need in-memory mutation.
- `createOutboxJob(tx, job)` -> `{status: "created"|"duplicate", job?}`.
- `leaseOutboxJobs({owner, now, limit, leaseMs})` returns jobs carrying `id`, `type`, `dedupeKey`, `safePayload`, `attempts`, and `leaseToken`.
- `ackOutboxJob({jobId, owner, leaseToken})` -> `{status: "acked"|"stale_fence"}`.
- `failOutboxJob({jobId, owner, leaseToken, terminal, nextAttemptAt, errorCode})` -> `{status: "retry_scheduled"|"terminal"|"stale_fence"}`.

Webhook behavior

1. Require the signature header and configured secret reference.
2. Read `request.arrayBuffer()` once and retain the untouched bytes.
3. Verify HMAC and the 300-second timestamp tolerance before parsing.
4. Reject live-mode input before opening a persistence transaction.
5. Persist only provider, provider event ID/type/time, test-mode marker, receipt time, and SHA-256 payload digest. Never persist raw bytes or signature through this service.
6. Apply a supported safe event in the same transaction. Duplicate event IDs return `duplicate` and skip the business effect.
7. Return success only after the transaction commits. Verification errors return 400; missing composition or durable write failure returns 503.

Outbox operation

No dispatcher starts automatically. An approved invocation boundary calls `dispatchOutboxBatch` with a stable worker owner, bounded batch, lease duration, attempt budget, and a consumer.

Defaults:

- batch limit: 10
- lease: 30 seconds
- maximum attempts: 5
- backoff: 1, 2, 4, 8, 16 seconds, capped at 60 seconds for larger configured budgets

Consumer contract:

- Treat `dedupeKey` as mandatory and durably claim it before a consequential business effect.
- Accept only `safePayload` and the explicit `sessionId`/`runId` ownership scope forwarded by the dispatcher; fetch scoped records using `sessionId` plus opaque IDs.
- Never acknowledge a job outside the active owner/token fence.
- Classify non-retryable failures with `retryable: false`; all failures become terminal at the attempt budget.
- Scope each job with the same `sessionId` and `runId` as its domain event. Duplicate outbox admission returns the existing job without repeating the mutation or event append.

Operation idempotency contract:

- `claimOperation` calls the data-owned `claimIdempotency` port in a transaction.
- The injected `createOperation(tx, context)` must durably create and link the operation in that transaction.
- The injected `readOperation(tx, context)` must read that durable link for replay. The service does not mutate an adapter-returned idempotency record or rely on object identity.

Recovery procedures

Committed job, acknowledgement lost:

1. Let retry eligibility or lease expiry make the job claimable.
2. Invoke the dispatcher with a new worker owner.
3. The consumer reclaims the same dedupe key and returns its existing result without repeating the business effect.
4. The current fence acknowledges the job. A stale worker acknowledgement must return `stale_fence`.

Unknown payment outcome:

1. Preserve operation and existing attempt as `unknown`; retain authority/inventory holds.
2. Call `scheduleUnknownOutcomeReconciliation` for that operation.
3. Confirm one job with dedupe key `reconcile:<attemptId>`.
4. Reconcile only the existing attempt. Never create a replacement solely because the outcome is unknown or timed out.

Terminal outbox failure:

1. Keep the failed job and correlated operation/receipt records.
2. Inspect safe error code, attempt count, job type, dedupe key, and correlation IDs. Do not inspect/log raw provider payloads or secrets.
3. Correct the local adapter/consumer issue.
4. Replay only through a future approved, fenced administrative interface that preserves the original dedupe key. M2 intentionally provides no automatic terminal replay.

Disable and rollback:

1. Stop new dispatcher invocations and workflow admission.
2. Keep verified webhook intake and reconciliation available for already-created records when the persistence composition is healthy.
3. Preserve pending/leased/retry/failed jobs, unknown operations, receipts, and event history.
4. Roll application code back only to a schema-compatible revision. No destructive cleanup is authorized.

Observability

`dispatchOutboxBatch` emits safe structured events through its injected `observe` callback:

- `outbox.delivery_started`
- `outbox.delivery_acked`
- `outbox.ack_stale_fence`
- `outbox.delivery_retry_scheduled`
- `outbox.delivery_terminal`
- `outbox.failure_stale_fence`

Fields are job ID, job type, SHA-256 digest of the dedupe key, attempt, safe error code, and next-attempt time where applicable. Raw dedupe keys, exception messages, and payload bodies are intentionally excluded. Observer failures are swallowed so telemetry cannot interrupt or misclassify durable delivery.

Recommended counters/gauges for integration:

- receipt verification rejection by safe reason;
- receipt persistence failure;
- duplicate receipt count;
- outbox pending/retry/terminal counts and oldest eligible age;
- delivery ack/retry/terminal/stale-fence totals;
- unknown operation count and oldest unresolved age;
- workflow status by definition version.

Alert candidates require owner thresholds: any terminal outbox job, repeated receipt persistence failure, increasing oldest eligible job age, stale-fence rate above expected failover tests, or unknown outcomes beyond the reconciliation objective.

Local verification

Run:

    node --test --test-reporter=spec test/m2-reliability-*.test.mjs
    npm test
    npm run docs:phases:check
    npx tsc --noEmit
    npm run build

Tests use only deterministic fakes, generated local signatures, synthetic identifiers, and sanitized payloads. They start no timers, worker, server, browser, provider call, container, or hosted resource.
