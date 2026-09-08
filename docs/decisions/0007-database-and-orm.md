# ADR-0007: Neon Postgres with Prisma ORM

- Status: proposed
- Date: 2026-09-08
- Owners/reviewers: Pradeep Nair
- Supersedes/superseded by: none

## Context

PaymentLab needs transactional authority, inventory, idempotency, ordered events,
webhook deduplication, and an outbox. The verified Vercel team has no existing
database. Vercel supplies new Postgres databases through Marketplace providers
rather than a first-party Vercel Postgres product.

## Decision drivers

- PostgreSQL transactions, uniqueness constraints, row locking, and migrations.
- Safe serverless connection behavior for Vercel Functions and Workflow steps.
- Typed TypeScript queries without hiding transaction boundaries.
- Separate pooled application access and direct migration/administrative access.
- Low-cost Phase 0/preview experimentation with a clear production upgrade path.
- Region, backup/restore, ownership, and cost controls that can be reviewed before
  a public Live Sandbox launch.

## Options considered

1. Neon through Vercel Marketplace plus Prisma ORM.
2. Prisma Postgres plus Prisma ORM.
3. Supabase Postgres plus Prisma ORM or a lighter SQL client.
4. A self-managed PostgreSQL instance.

All first three can satisfy the logical model. Neon has a documented Vercel
integration, PgBouncer transaction pooling, a direct connection path for
migrations, scale-to-zero, branching, and a no-card Free plan suitable for the
capability spike. Its current Free limits include 0.5 GB storage per project and
a short restore window, so it is not automatically the production tier.

Prisma Postgres provides the closest integrated ORM experience, but its Free
tier is positioned for evaluation and currently uses an operations allowance.
Supabase provides a broader platform and a serverless transaction pooler, but
PaymentLab does not need its additional auth/storage/realtime surface in the MVP.
Self-management adds operational work without improving the product boundary.

## Decision

Propose Neon Postgres through the Vercel Marketplace with Prisma ORM. Runtime
code uses the provider's pooled connection string. Schema migrations and
administrative jobs use a separate direct connection string. Application code
must make critical transaction boundaries explicit; workflow durability never
replaces database uniqueness, locking, or the transactional outbox.

Use one isolated development/preview database for the Phase 0 spike. Before any
public Live Sandbox, explicitly approve the region and paid/free tier, verify
backup/restore behavior and alerting, and decide whether preview deployments use
database branches or a separately owned database. No database is created by this
ADR.

## Consequences

- The MVP gets conventional PostgreSQL semantics and generated TypeScript types.
- Transaction-pooler limitations prohibit relying on session state, `LISTEN`, or
  session advisory locks in runtime code.
- Migrations require the direct URL and deployment serialization.
- Free-tier scale-to-zero may add cold-start latency; the short restore window is
  not sufficient evidence for production recovery objectives.
- Provider and ORM versions must be pinned during application scaffolding.
- Moving to another managed PostgreSQL provider remains possible because product
  truth stays in standard schemas and migrations.

## Verification

- [Phase 0 environment inventory](../phase-0-environment-inventory.md)
- [Neon pricing and plan limits](https://neon.com/pricing)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Postgres on Vercel Marketplace](https://vercel.com/docs/postgres)
- Pending: owner authorization, provider account/region selection, transaction
  and lock spike, migration test, restore test, and cost alert review.
