PaymentLab AI — M2 engineering integration plan

Status: approved for local/isolated execution
Contract: docs/product/paymentlab-ai-m2-prd.md vM2.0
Baseline: 09fa466
Integration owner: Emily

Architecture boundary

M2 adds provider-neutral PostgreSQL persistence, durable-event/outbox primitives, a fail-closed webhook receipt service, and authenticated runtime ACP contracts. PostgreSQL is business truth. No service may call Stripe or another provider, start an unattended worker, expose browser credentials, or enable Live Sandbox.

Shared interfaces

Data platform owns additive SQL migrations and the PostgreSQL adapter under `db/`, `lib/persistence/`, and `lib/events/`.

The persistence adapter must expose transaction-scoped operations with explicit ownership:

- `withTransaction(work)` commits all writes or rolls all back.
- `appendDomainEvent(tx, {eventId, runId, sessionId, type, schemaVersion, safePayload})` allocates a unique contiguous per-run sequence while holding a database row lock.
- `claimIdempotency(tx, {sessionId, scope, key, requestHash})` returns `created`, `replay`, or `conflict` and never changes an existing hash.
- `recordWebhookReceipt(tx, receipt)` returns `created` or `duplicate`; raw payloads and secrets are not accepted.
- `createOutboxJob(tx, job)` writes a dedupe-keyed job in the same transaction as the business event.
- `leaseOutboxJobs`, `ackOutboxJob`, and `failOutboxJob` use lease owner/token/expiry fencing.
- All run/checkout lookups require `sessionId` plus opaque resource ID; an ID alone is never authorization.

Integrations/reliability owns pure services under `lib/payments/`, `lib/reconciliation/`, `lib/outbox/`, and `lib/workflows/`, plus the existing Stripe webhook route. Services consume the persistence interface; they do not own schema files. The webhook verifier must run on untouched bytes before JSON parsing. No provider client or provider mutation method is permitted.

Application owns runtime ACP HTTP routes and `lib/acp/runtime/`. Routes consume a repository/service port supplied by integration; they do not import SQL, Stripe, or workflow implementations. Authentication is a server-held bearer token resolved only in the route boundary. Every read/write includes `sessionId`, `runId`, API version `2026-04-17`, and a generated request ID. Safe errors are exactly `{code,message,retryable,requestId}`. Complete and delegated-payment operations remain capability-blocked.

Dependency order

1. Data schema and persistence adapter establish durable contracts.
2. Reliability services integrate through the persistence port and produce recovery evidence.
3. ACP routes integrate through the application service port and default-disabled feature flags.
4. Emily reconciles interfaces, applies all changes on `feat/m2-persistence-runtime`, runs disposable PostgreSQL tests, then hands one exact candidate to Tab.

Owned packages

- `M2-DATA-001`: data-platform-engineer; `db/**`, `lib/persistence/**`, `lib/events/**`, `test/m2-data-*.test.mjs`, data-model/data-flow migration sections.
- `M2-REL-001`: integrations-reliability-engineer; `app/api/webhooks/stripe/**`, `lib/payments/**`, `lib/reconciliation/**`, `lib/outbox/**`, `lib/workflows/**`, `test/m2-reliability-*.test.mjs`, workflow/runbook docs.
- `M2-APP-001`: application-engineer; `app/api/acp/**`, `lib/acp/runtime/**`, `lib/application/**`, `test/m2-acp-*.test.mjs`, ACP compatibility and feature-flag docs.

Cross-package rules

- Do not modify another package’s owned paths.
- Do not edit `package.json` or `package-lock.json`; request dependency changes in the completion envelope for Emily to integrate.
- If a required interface differs from this contract, stop and return `BLOCKED` with the exact conflict. Do not silently fork a duplicate contract.
- Commit only to the assigned local specialist branch. No push, PR, merge, deploy, credential/resource mutation, hosted database mutation, webhook destination, or payment.

Integration checks

- Existing `npm test`, docs phase validation, TypeScript, and build.
- Focused M2 unit, contract, security, recovery, and disposable PostgreSQL integration tests.
- Migration empty apply, repeatability, schema/constraint inspection, transactional rollback, and disposable rollback rehearsal.
- Secret scan and explicit no-provider-call/no-live-admission checks.
- Clean worktree and exact commit read-back.

Rollback

All migrations are additive. Application flags default off. Code rollback keeps tables and unresolved records. Migration down/rehearsal is allowed only against a disposable test database. Hosted or owner database rollback is not authorized.