# PaymentLab AI M2 integrated-candidate evidence

Status: local QA candidate; not Product-accepted or release-ready

## Inputs

- Product contract: `docs/product/paymentlab-ai-m2-prd.md` at accepted baseline `09fa466`
- Engineering interfaces: `docs/m2-engineering-plan.md` and ADR-0009 at `b29aad640a45cad0ad8a15d35b6adebf7a0d90fc`
- Data package: `876a3ba`
- Reliability package: `db173e40fc16e6bee60e4ed8199cd1d28ccc1986`, followed by reviewed hardening commit `441bb77784dbcf0a1b1472892e4bcf34fc5b53c1`
- ACP application package: `5bc3b2b68fe03661f7a81be7e74562be3668d179` (authoritative final commit, superseding `e9e18df`)

The packages were integrated, in the order above, into the clean local sibling worktree `/Users/pradeepnair/Documents/GitHub/PRADPAY-m2-integrated` on `feat/m2-integrated-candidate`. Because the authoritative Avery commit amended the previously reviewed `e9e18df`, its exact two-file delta was applied and reviewed after the initial cherry-pick; the candidate therefore contains the complete `5bc3b2b` tree content for Avery-owned paths. The unrelated dashboard/UI edits in `/Users/pradeepnair/Documents/GitHub/PRADPAY-impl` were not reset, stashed, overwritten, deleted, or copied into this candidate.

## Integration decision

Package review found that the reliability services and the PostgreSQL repository used different port shapes for idempotency outcomes, webhook receipts, outbox creation, leases, acknowledgements, and failures. `lib/persistence/reliability-adapter.mjs` now provides the explicit translation boundary instead of silently coupling either package to the other's representation. It:

- Converts database outcome strings to reliability dispositions.
- Creates internal webhook/outbox IDs without accepting provider secrets or raw webhook bodies.
- Translates `type` to the persisted `kind` and snake-case database rows to the reliability job contract.
- Wraps lease, acknowledgement, and failure transitions in repository transactions.
- Preserves session/run ownership and lease-token fencing.
- Maps non-retryable delivery failures to terminal durable state.

`test/m2-integration-contracts.test.mjs` exercises those cross-package contracts. `lib/persistence/postgres.mjs` now accepts an explicit terminal failure decision while retaining attempt exhaustion and fencing checks.

## Verified commands and results

Executed from `/Users/pradeepnair/Documents/GitHub/PRADPAY-m2-integrated` unless noted otherwise.

1. `npm ci`
   - Exit 0; 32 packages installed/audited; 0 vulnerabilities.
2. `node --test test/m2-integration-contracts.test.mjs test/m2-data-persistence.test.mjs`
   - Exit 0; 12 passed, 0 failed, 0 skipped.
3. `npm test`
   - Exit 0; 105 passed, 0 failed, 0 skipped.
   - Includes migration apply/reapply/rollback, ownership constraints, atomic event persistence, 16 concurrent event writers, idempotency, durable webhook receipts, outbox recovery/fencing, deterministic workflow behavior, ACP authentication/version/scope/error/flag controls, replay isolation, and the six integration-adapter tests.
4. `npx tsc --noEmit`
   - Exit 0; no diagnostics.
5. `npm run docs:phases:check`
   - Exit 0; seven generated phase pages plus index current; six Markdown/HTML phase pairs, template pair, navigation, structure, and local links validated.
6. `npm run build`
   - Exit 0; Next.js 16.3.4 production build compiled; TypeScript completed; four static pages generated; ACP and webhook routes recognized as dynamic routes.
7. Secret-pattern search over tracked source/document/schema extensions for Stripe keys, webhook secrets, AWS access-key shapes, private-key headers, and literal password assignments.
   - 0 matches.
8. Disposable-database cleanup query, using the existing container-configured `$POSTGRES_USER` and `$POSTGRES_DB` without printing either value:
   - `SELECT count(*) FROM pg_database WHERE datname LIKE 'paymentlab_m2_data_%'`
   - Result `0`.
9. `git diff --check`
   - Exit 0; no whitespace errors.

## PostgreSQL and rollback

Only the existing local `paymentlab-postgres` container and its configured role/database mechanism were used. The nonexistent default `postgres` role was not created. No credential or role value was printed or changed.

The migration is additive and repeatable. Runtime rollback is forward-fix by default because removing durable payment records is destructive. `db/migrations/202609180001_m2_persistence_foundation/down.sql` is explicitly restricted to disposable test databases. Its destructive rollback was rehearsed only in a generated disposable database, followed by successful reapplication and cleanup.

Code rollback is a local branch reset/revert of the candidate integration commit(s); it requires no provider or hosted-resource action. Any future environment deployment must apply a separately approved forward migration rather than run the destructive down migration against retained data.

## Remaining gates and limitations

- This evidence does not constitute independent QA or Product acceptance.
- Runtime webhook composition remains fail-closed until an approved runtime pool/adapter and business-event transaction callback are configured.
- Runtime ACP payment-completion and delegated-payment capabilities remain blocked by default and cannot reach the injected port.
- No hosted PostgreSQL, external workflow vendor, Stripe endpoint, or payment capability was configured or exercised.
- Managed provider/region/tier, database driver lifecycle, workflow vendor, retention/restore objectives, and operator-access policy remain owner decisions for a later approved gate.

## External-action declaration

No push, PR, protected/default-branch merge, deploy, provider call, webhook destination, credential or role change, hosted database mutation, Live Sandbox action, or payment action occurred.
