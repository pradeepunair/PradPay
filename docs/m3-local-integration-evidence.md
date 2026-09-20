PaymentLab AI — M3 local synthetic integration evidence

Authority

- Product contract: `/Users/pradeepnair/Documents/GitHub/PRADPAY-m3-local/docs/product/paymentlab-ai-m3-readiness.md`, version M3.1-readiness.
- Accepted M2 baseline: `f50d896ee5f6dfcca1a0b0020f1d0f8fc34eaea4`.
- Integration branch/worktree: `feat/m3-local-synthetic` at `/Users/pradeepnair/Documents/GitHub/PRADPAY-m3-local`.
- Local-only boundary: no provider call, credential access/change, webhook destination, hosted resource, deployment, DNS change, payment, Live Sandbox, push, PR, or merge.

Source packages and integrated commits

- Engineering plan: `4af65a59444fdcc738ea786ac4bdd63bf455eb7c` -> `4af65a5`.
- M3.1 plan correction: `51be74f9c9c4bef72e563585316d40488d1bd5b3` -> `51be74f`.
- Data source: `a1df6db92d24a08872d21926440a0eb25194a104` -> integrated `87251a3`.
- Reliability source: `0f3caa4fcfb4b7cb8ae62fded0497297d53e3fdf` -> integrated `fd29a94`.
- Reliability correction: `8b2f7116fb16bc4956d31cda9693657960f43f28` -> integrated `27380a5`.
- Application source: `a659cb83e88a9f4ba8bee7f0292681cca3ad34cc` -> integrated `150f535`.
- Integration contracts/schema projection fix: `c2f47a81cad0fad7d34e21069819cc3bb7668df9`.

Integration decisions

- `PostgresPersistence` remains the transaction-scoped data authority.
- `createReliabilityPersistenceAdapter(dataPersistence)` maps accepted M2 outbox envelopes.
- `createLocalSafetyPersistence({dataPersistence,outboxPersistence})` composes M3 safety/reconciliation with the mapped outbox.
- `createLocalSafetyController({persistence})` defaults closed and permits only durable-attempt-verified reconciliation after admission is disabled.
- `createLocalWebhookComposition` requires an injected pg-compatible pool, endpoint secret, transaction-scoped provider-reference resolver, allowlisted event set, and business callback. It creates no connection at import and exposes no provider mutation client.
- `createLocalAcpComposition({persistence})` uses the concrete PostgreSQL persistence interface for create/retrieve/update/cancel only.
- Request line-item shapes are not projected directly as ACP response `LineItem` records. The integrated persistence returns an empty canonical response list until a bounded business resolver creates schema-valid response items, preventing invalid data from escaping.
- Complete and delegate-payment remain hard-blocked before application-port invocation. Every response advertises `capabilities.payment.handlers: []`.

Defects found and corrected during integration

1. Reliability review found that a post-effect callback rejection could strand an unknown effect without reconciliation. Correction `8b2f711` converts it to stable unknown and atomically schedules one deduplicated action.
2. Reliability review found caller-asserted unknown status, kill-switch reconciliation discontinuity, and permissive opaque-reference authorization. Correction `8b2f711` requires durable attempt state and a transaction-scoped resolver while allowing verified reconciliation with admission disabled.
3. Cross-package ACP execution found that raw create-request line items produced an invalid pinned ACP response. Integration commit `c2f47a8` keeps response items canonical/empty until resolved and adds concrete adapter tests.

PostgreSQL evidence

Existing local container only: `paymentlab-postgres` (`postgres:16-alpine`). Tests use only the container-configured `$POSTGRES_USER`/`$POSTGRES_DB`; they do not assume or create role `postgres` and do not print credentials.

Focused command:

`node --test test/m3-data-*.test.mjs test/m3-reliability-*.test.mjs test/m3-acp-composition.test.mjs test/m3-integration-contracts.test.mjs`

Result: 61 passed, 0 failed, 0 skipped.

This includes:

- Empty/repeat migration apply.
- Additive down/reapply rehearsal: six M3 tables -> zero M3 tables while M2 remains -> six M3 tables.
- Concurrent count and amount reservations below their ceilings.
- Atomic reservation rollback.
- Stable reserved/denied replay and changed-input conflict.
- Admission-disabled reconciliation continuity.
- Scoped ACP data operations.
- Seven deterministic synthetic fault scenarios.
- Post-effect callback failure and exactly-one reconciliation scheduling.
- Transaction-scoped webhook authorization and rollback behavior.
- Real cross-package adapters for safety/reconciliation/outbox and ACP CRUD/idempotency envelopes.
- Complete/delegate hard blocks and empty handler advertisement.

Full verification before evidence commit

- `npm test`: 167 passed, 0 failed, 0 skipped.
- `./node_modules/.bin/tsc --noEmit`: exit 0, no diagnostics.
- `npm run docs:phases:check`: passed; seven generated pages plus index current; six Markdown/HTML phase pairs, template, navigation, structure, and links validated.
- `npm run build`: passed; Next.js 16.3.4 compiled, typechecked, and generated 4/4 static pages.
- `git diff --check`: exit 0.

Dependency decision

The accepted composition consumes an injected pg-compatible pool and does not create a global pool. The repository had no approved concrete PostgreSQL driver. Emily reviewed `pg`; registry metadata reported version `8.23.0` with Node `>=16`, but installation was blocked because the configured threat-intelligence scan timed out and could not complete. No package was installed and `package.json`/`package-lock.json` remain unchanged. Bypassing that security control was rejected. A concrete runtime pool/driver remains a separately reviewed dependency gate; local interface, transaction, SQL, migration, and composition behavior are covered without accessing credentials.

Security and no-external-action evidence

- New synthetic provider imports no network/provider SDK, timers, worker, or process capability.
- Webhook composition uses the existing Stripe static signature verifier only; it has no mutation-capable provider client.
- Provider references require transaction-scoped resolver authorization before business mutation.
- Raw webhook body/signature and secrets are not persisted.
- Product artifacts were preserved outside implementation commits.
- No Stripe/provider call, credential access/change, webhook destination, hosted resource, deployment, DNS change, payment, Live Sandbox, push, PR, merge, protected-branch change, or production action occurred.

Rollback

Operational rollback disables admission and stops new synthetic invocation while preserving attempts, receipts, reconciliation controls, domain records, and outbox work. Verified receipt processing and reconciliation of existing unknown attempts continue. The M3 down migration is destructive and authorized only for disposable tests; it is not an operational rollback.

Remaining gates

Local M3.1 completion does not authorize or establish:

- A concrete runtime PostgreSQL pool dependency or any database connection credential.
- Authenticated Stripe capability or ADR-0003 acceptance.
- Credential creation, use, or rotation.
- Stable HTTPS callback, signing-secret custody, or webhook destination.
- Hosted database/workflow availability, backups, RPO/RTO, capacity, or operator controls.
- Provider-backed reconciliation.
- Payment-handler enablement, test/real payment, deployment, DNS, Live Sandbox, push, PR, protected-branch merge, production promotion, or release readiness.
