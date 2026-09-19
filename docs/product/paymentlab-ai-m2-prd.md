PaymentLab AI — Milestone 2 Persistence, Durability, and Runtime ACP Contract
Work item: PaymentLab-AI-MVP
Parent contract: PaymentLab-AI-MVP-PRD.html / embedded Markdown v1.0
Prior decision: M1.0 product acceptance; M1 accepted only for synthetic Guided Replay/domain foundation and pinned offline ACP scaffolding
Baseline: accepted M1 HEAD `fa54434f085aa697bdf7ac21293554deb60c6fe4`
Version: M2.0
Date: 2026-09-18 CDT
Product owner: Pete
Implementation owner: Emily
Repository: `/Users/pradeepnair/Documents/GitHub/PRADPAY-impl`
Status: implementation-ready contract; execution requires this contract to be accepted by Product/Hermes

1. Objective and milestone classification

Build the non-payment runtime foundation required for a truthful, recoverable PaymentLab: PostgreSQL persistence and explicit migrations; domain events and durable, verified webhook receipts; idempotency and reconciliation records; a transactional outbox; a selected durable workflow runner interface and decision; and authenticated, pinned runtime ACP endpoints with contract tests.

M2 is implementation with capability gates. It may use synthetic providers, test adapters, and local/isolated resources. It must not execute Stripe payment mutations or enable anonymous Live Sandbox admission. M2 completion means the system can persist and recover the state needed for later payment work, not that a payment has succeeded.

2. Authorized scope

In scope:
- Select and document a PostgreSQL/Neon development/preview resource only after explicit owner approval; otherwise implement provider-neutral migration/schema work and a local test database strategy.
- Add backward-compatible migrations for session/run, checkout, mandate, payment/attempt, webhook receipt, domain event, outbox, idempotency, and reconciliation records required by the parent data model.
- Implement transactional event append plus per-run monotonic sequence, safe projections, schema versioning, and idempotent reducers.
- Implement Stripe webhook intake as a fail-closed, raw-body signature-verified boundary with durable receipt-before-acknowledgement, provider event uniqueness, duplicate handling, and out-of-order protection. Test adapter only; no provider delivery is required for M2.
- Implement operation idempotency records with request hash conflict detection, stable operation keys, one-active-attempt and one-successful-sale constraints, and safe retry/reconciliation states.
- Implement transactional outbox records and a dispatcher interface; prove recovery when commit succeeds before dispatch acknowledgement.
- Decide Vercel Workflow versus a persisted outbox/queue fallback through a documented interface and bounded local/isolated spike. Keep business truth in PostgreSQL regardless of runner.
- Implement runtime ACP create/retrieve/update/complete/cancel and delegate-payment route contracts behind server-held authentication, run scope, pinned `2026-04-17` artifacts, request/response validation, and application idempotency. Completion must remain gated and return a truthful unsupported/blocked result when no payment handler is configured.
- Add contract, integration, security, migration, recovery, and deterministic unit tests; update traceability and operational documentation.

3. Explicit non-goals and prohibited actions

- No Stripe PaymentIntent/payment mutation, test charge, SPT issuance, provider credential use, or payment-handler enablement.
- No anonymous Live Sandbox admission, public live run, model/agent execution, real shipping/PII, or production buyer identity.
- No production database, production webhook, DNS/domain, Vercel deployment, paid resource provisioning, credential creation/rotation, or external publication.
- No PayPal/fallback processor, refunds, disputes, delayed/partial capture, settlement, or fulfillment.
- No browser/in-memory workflow state, long timers, untracked background promises, or business truth stored only in Workflow.
- No destructive migration, data deletion, reset of an owner database, or automatic provider selection based on unverified capability.

4. Work packages and exact deliverables

M2-WP1 — Resource and runtime decision
Files:
- Create `docs/decisions/0009-m2-persistence-and-runtime.md`.
- Update `docs/decisions/0007-database-and-orm.md` only if the verified provider/ORM decision changes its proposed status.
- Update `docs/decisions/0004-durable-workflow.md` with the selected interface, spike evidence, fallback, and limits.
Tasks:
- Record provider, region, plan, pooled/direct connection strategy, migration ownership, and cost/approval evidence; never infer Neon resource existence from a project link.
- Select Prisma or another typed ORM only after transaction/connection behavior is verified; preserve explicit transaction boundaries.
- Define `DurableWorkflowRunner` interface for start, resume, wait/hook, retry, cancel, status, and callback wake-up. Record Workflow or queue choice and why.
- Gate live use if a resource, entitlement, cost, or durability prerequisite is missing.

M2-WP2 — Schema and migration foundation
Files:
- Create `prisma/schema.prisma` or the repository-equivalent schema.
- Create `prisma/migrations/<timestamp>_m2_persistence_foundation/*` or equivalent migration directory.
- Create/update `docs/data-model.md`, `docs/data-flow.md`, and `README.md` with local setup and migration commands.
Tasks:
- Add foreign keys, ownership scope, UTC timestamps, explicit versions, integer minor units, uniqueness, and indexes for the parent data model.
- Required tables/records: visitor sessions, runs, checkouts, quotes, mandates, mandate usage, orders, payments, payment attempts, webhook receipts, domain events, outbox jobs, idempotency keys, reconciliation jobs, and usage/admission state needed for future gates.
- Make migration forward and backward compatible with the replay-only application; no destructive changes.
- Provide seed/test fixtures only; never commit credentials or provider payload secrets.

M2-WP3 — Durable events and projections
Files:
- Create/update `lib/events/*` (append, sequence allocation, reducer/projection, schema validation, redaction).
- Create/update domain event tests under `test/`.
Tasks:
- Append state mutation and event in one transaction.
- Allocate unique monotonic per-run sequence under concurrency.
- Reject duplicate event IDs and invalid ownership; tolerate unknown event types without projection corruption.
- Ensure projections omit secrets, credentials, PAN/CVV, bearer tokens, raw payment tokens, hidden reasoning, and merchant-private data from unauthorized views.
- Preserve replay compatibility with recording schema 1.0.0.

M2-WP4 — Webhook receipts, idempotency, and reconciliation
Files:
- Create/update `app/api/webhooks/stripe/route.ts` or repository-equivalent route.
- Create/update `lib/payments/*`, `lib/reconciliation/*`, and related schema modules.
- Create/update tests for webhook, idempotency, and reconciliation behavior.
Tasks:
- Read untouched raw body; verify endpoint-specific signature and timestamp tolerance before parsing.
- Reject missing/invalid signatures and live-mode events; persist verified receipt before returning success.
- Enforce provider/event uniqueness; duplicate receipt has one business effect; out-of-order events cannot regress terminal state.
- Create stable operation/attempt records before any future provider call; same operation key plus same request hash returns the same result; changed payload conflicts.
- Preserve `unknown` outcomes and reconciliation ownership; never create a new attempt solely after a timeout.
- Implement bounded reconciliation scheduling/interface without an active payment call in M2.

M2-WP5 — Transactional outbox and workflow adapter
Files:
- Create/update `lib/outbox/*`, `lib/workflows/*`.
- Create/update `docs/decisions/0004-durable-workflow.md` and operational runbook documentation.
- Add integration/recovery tests under `test/`.
Tasks:
- Write business mutation, domain event, and outbox job in one transaction.
- Dispatcher leases jobs with fencing/expiry, bounded retry/backoff, dedupe key, and observable terminal failure.
- Recover committed outbox work if dispatch acknowledgement is lost or worker crashes.
- Ensure browser disconnect does not stop committed work; do not run a live payment.
- Exercise an isolated local runner or documented fake for approval wait, callback wake-up, retry, cancellation, and deployment/version behavior where available.

M2-WP6 — Runtime ACP endpoints and contract tests
Files:
- Create/update `app/api/acp/*` or repository-equivalent routes.
- Create/update `lib/acp/*` for pinned wire validation, authentication context, operation mapping, and error translation.
- Create/update `test/acp/*` contract tests and `docs/acp-compatibility.md`.
Tasks:
- Implement create, retrieve, update, complete, cancel, and delegate-payment route contracts against pinned commit `7fdd78df677a94dce04c770644b0fbbb1401272b` / API version `2026-04-17`.
- Validate requests and responses against vendored schemas; reject unsupported fields and malformed identifiers.
- Require server-held bearer authentication at the ACP boundary; never expose it to browser JavaScript.
- Bind every checkout/run to an authorized session/service context; opaque IDs alone are not authorization.
- Require application idempotency on mutations and safe error shape `{code,message,retryable,requestId}` without secrets.
- Complete/delegate-payment must remain disabled or return an explicit capability-blocked result until M0 handler prerequisites are proven; tests must assert no payment mutation.

5. Acceptance criteria

M2-AC01 — Persistence decision and migration reproducibility
A provider/ORM/resource decision is documented with source/date/approval boundary, or a precise blocker is recorded. Migrations apply to an empty test database, are repeatable in CI, and have a backward-compatible rollback/forward plan without destructive owner-data mutation.

M2-AC02 — Ownership and durable schema invariants
Schema tests prove foreign keys, run/session ownership, unique provider event IDs, one active attempt per checkout, one successful purchase per mandate, integer money, UTC timestamps, and required indexes/constraints.

M2-AC03 — Atomic event persistence
A state mutation and its domain event commit together or both roll back. Concurrent writers produce a unique monotonic per-run sequence; duplicate event IDs and unauthorized run access are rejected.

M2-AC04 — Verified durable webhook boundary
Raw-body signature verification occurs before parsing; invalid/missing signatures and live-mode events do not mutate trusted state. A valid receipt is durably stored before acknowledgement; duplicate delivery is acknowledged without duplicate business effect; out-of-order events do not regress state.

M2-AC05 — Idempotency and unknown outcome safety
Same operation key and identical request hash return the existing operation/result. Reuse with changed parameters conflicts. An unknown outcome remains reconcilable and does not create a new attempt or release mandate/inventory automatically.

M2-AC06 — Transactional outbox recovery
Every asynchronous consequential action has a committed outbox record. A crash after database commit and before dispatch acknowledgement is recovered exactly once at the business-effect layer through idempotent consumption; leases/fences prevent concurrent duplicate dispatch.

M2-AC07 — Durable workflow interface and decision
The selected runner or fallback implements start/resume/wait/retry/callback/cancel/status boundaries, with evidence for approval wait, browser closure, callback wake-up, retry, crash recovery, observability, retention, limits, and version behavior. If evidence fails, fallback is selected and live admission remains off.

M2-AC08 — Runtime ACP contract surface
All six pinned ACP operation surfaces validate request/response schemas, version headers, authentication context, run scope, and application idempotency. Contract tests cover success, malformed input, unsupported capability, provider error, duplicate mutation, and safe error redaction. No handler is advertised without account capability evidence.

M2-AC09 — Security and redaction
Cross-session reads/mutations, CSRF/origin violations, role escalation, SSRF/open redirects, prompt/tool arguments, and secret-bearing projections are rejected or safely bounded. Automated secret scans find no credentials, tokens, PAN/CVV, or reusable payment values in source, fixtures, logs, events, or test output.

M2-AC10 — Live-payment gate remains closed
Tests and configuration prove no Stripe/payment mutation, SPT issuance, live admission, or production callback use occurs in M2. Completion/delegate-payment reports a truthful blocked/unsupported capability until M0 prerequisites are separately accepted.

M2-AC11 — Reproducible quality evidence
`npm ci`, unit/integration/contract/security tests, migration checks, docs validation, type check, and build pass in a clean worktree. Evidence names exact commit, commands, environment, database mode, test counts, and any unavailable checks. No criterion is accepted from a plan alone.

6. Test matrix and required evidence

| Area | Required tests | Evidence required |
| --- | --- | --- |
| Schema/migrations | empty apply, repeat/idempotency, backward-compatible deploy, constraint/index inspection, rollback rehearsal on disposable DB | migration command output, schema snapshot, provider/DB mode, rollback result |
| Ownership/security | session isolation, authorization, CSRF/origin, role projection, malformed IDs, SSRF bounds, secret scan | test counts and redacted failure/output samples |
| Events | atomic rollback, concurrent sequence, duplicate ID, unknown event, deterministic reducer | reproducible integration output and event rows/projections |
| Webhooks | raw-body valid/invalid signature, timestamp tolerance, live-mode rejection, duplicate, out-of-order, receipt-before-ack failure | route tests, durable receipt rows, response codes; provider delivery only if separately authorized |
| Idempotency | same key/same hash, same key/changed hash, timeout unknown, reconciliation retry, one-active-attempt | operation/attempt records and exact state transitions |
| Outbox/workflow | commit-before-dispatch crash, lease expiry, duplicate worker, retry/backoff, callback wake, browser closure, cancellation | local/fake or isolated runner trace with correlation IDs and no payment mutation |
| ACP | six operations, pinned schemas/hashes, auth/version/run scope, error mapping, unsupported handler, idempotency | contract test output and manifest/hash verification |
| Quality | npm ci, npm test, tsc, build, docs phase check, clean-worktree read | exact commands, counts, commit SHA |

7. Security and operational boundaries

- No secret values in files, commits, browser payloads, model context, logs, fixtures, events, or chat. Use placeholders and approved secret storage only.
- M2 may create no paid resource, database, integration, environment variable, credential, webhook destination, or deployment. Any provider/resource mutation requires separate owner authorization.
- All database access is server-only; use pooled runtime URL and direct migration URL only after approved resource selection. Never rely on session state, LISTEN, or advisory locks with transaction pooling.
- Keep Stripe route reachable only as a fail-closed test boundary; no live/test credential configuration is implied by this contract.
- Redact provider payloads by allowlist, persist minimum safe receipt fields, and retain unresolved reconciliation records until resolved.
- Keep Live Sandbox admission, completion, and delegate-payment disabled by feature flag/configuration and test the disabled path.

8. Migration and rollback plan

Migration strategy:
1. Design additive schema and constraints against the existing replay-only application; no runtime dependency until compatibility checks pass.
2. Apply migrations to disposable/local test database; run schema and data-integrity checks.
3. For any approved isolated preview resource, take provider-supported backup/snapshot before apply and record migration ID.
4. Deploy code that can read old/new schema during transition; backfill only synthetic/test rows with bounded, observable jobs.
5. Enable persistence/outbox/ACP routes behind flags; keep payment mutation disabled.

Rollback:
- Disable new persistence/workflow/ACP admission flags while retaining read-only replay.
- Stop new outbox dispatch but preserve webhook intake/reconciliation for any already-created records.
- Roll application back only to a schema-compatible build; do not drop columns/tables during routine rollback.
- Revert additive migration only on disposable/test databases unless an explicitly approved reversible migration exists.
- Preserve unresolved attempts/receipts and operator diagnostics; never delete them to make tests pass.
- Record rollback command, migration ID, affected environment, and resulting health checks.

9. Blockers, assumptions, and open questions

Known blockers:
- No verified database resource currently exists; Neon remains a proposal and must not be provisioned in M2 without approval.
- No signed provider callback, durable receipt, SPT/profile entitlement, or payment handler is verified.
- Workflow documentation/dashboard visibility is not proof of project activation or durability.
- Local Git is available in the implementation repository, but the accepted branch must remain local-only.

Assumptions:
- M1 replay/domain code and pinned ACP artifacts remain the compatibility baseline.
- PostgreSQL semantics, not the workflow runner, are business truth.
- Synthetic/local test adapters are acceptable for M2 evidence when clearly labeled and incapable of payment mutation.

Open questions requiring Product/Hermes or owner decision:
- Approve Neon versus another managed PostgreSQL provider, region, tier, cost ceiling, and preview isolation.
- Approve Prisma or alternative typed ORM after the connection/transaction spike.
- Approve Vercel Workflow after the durability/cost spike, or select a queue/worker fallback.
- Define retention, backup/restore objective, and operator access policy for receipts/events.
- Confirm whether runtime ACP routes should be local-only until a verified staging callback exists.

10. Handoff and next owner

Emily owns implementation only after Hermes/Product accepts this M2.0 contract. Tab owns the M2 traceability matrix and exact-candidate verification. Pixel is not required for this backend milestone, but any new UI/state presentation needs a separately accepted design artifact. Hermes coordinates owner approvals for provider/resource decisions and the next staged handoff.

This contract does not authorize push, PR, merge, deploy, credential changes, paid provisioning, database mutation, or payment action.
