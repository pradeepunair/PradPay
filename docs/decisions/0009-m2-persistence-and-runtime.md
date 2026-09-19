# ADR-0009: Local PostgreSQL truth with persisted-outbox fallback

- Status: accepted for local M2 implementation
- Date: 2026-09-18
- Owner/reviewer: Emily / Product M2.0
- Scope: local and disposable only

## Context

M2 needs transactional ownership, idempotency, receipts, events, outbox recovery, and runtime ACP contracts. No managed database, Workflow entitlement, credential change, deployment, provider call, or payment is authorized. An existing local PostgreSQL 16 container is available for disposable testing.

## Decision

Use additive, provider-neutral PostgreSQL SQL migrations and explicit transaction boundaries. Exercise migrations and durability only in disposable databases created inside the existing local `paymentlab-postgres` container. Do not provision or infer a hosted Neon resource.

Select the persisted PostgreSQL outbox plus an explicit `DurableWorkflowRunner` port as the M2 fallback. The local spike uses a deterministic fake/inline invocation under test control; it does not start an unattended process or long timer. Vercel Workflow remains unselected until project activation, durability, versioning, limits, cost, and approval evidence exist.

Runtime ACP routes remain default-disabled behind local application flags, require server-held bearer authentication, enforce session/run scope and API version `2026-04-17`, and use only synthetic repositories/adapters in route tests. Complete and delegated-payment operations return truthful capability-blocked errors until the payment-handler gate is separately accepted.

## Consequences

- PostgreSQL, not a workflow platform or browser, is business truth.
- Additive SQL remains portable to an approved managed PostgreSQL provider later.
- No provider, region, plan, pooled URL, backup objective, or cost claim is made.
- Local test evidence cannot establish hosted availability, backup/restore, callback reachability, or production durability.
- A later owner decision is required for managed PostgreSQL, ORM/driver policy, workflow vendor, retention, recovery objective, and operator access.

## Verification

- Empty disposable database migration and repeatability checks.
- Constraint/index inspection and transaction/concurrency integration tests.
- Commit-before-dispatch and lease-fencing recovery tests.
- Auth/version/run-scope ACP contract tests.
- Existing replay regression suite and build.

## Rollback

Disable M2 flags and stop dispatch while preserving tables and unresolved records. Application rollback must remain schema-compatible. Drop/recreate is permitted only for the disposable test database created by the test harness.