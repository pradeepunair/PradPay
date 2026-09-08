# ADR-0001: Separate Vercel application with durable execution and Postgres

- Status: proposed
- Date: 2026-09-08
- Owner/reviewer: Pradeep Nair / pending

## Context

PaymentLab needs bounded HTTP APIs plus workflows that survive browser closure,
approval waits, function termination, callbacks, and deployment changes. The
existing portfolio is a separate static-export Next.js project and must not
absorb payment credentials, dynamic APIs, or unrelated deployment risk.

## Decision drivers

- Independent release and rollback from the portfolio.
- Durable authority/payment/reconciliation state with database transactions.
- Stable public Stripe callback and replay-only fallback.
- Small-team operational simplicity and explicit cost controls.

## Options considered

1. Separate Vercel project + Vercel Workflow + managed Postgres.
2. Separate Vercel UI/API + external queue/worker + managed Postgres.
3. Add PaymentLab routes to the static portfolio project.
4. Browser/in-memory background execution.

Options 3 and 4 conflict with isolation and durability requirements. Option 2
remains the fallback if the Workflow spike fails.

## Proposed decision

Use the existing PradPay repository as a separate Next.js application deployed
to a new project under verified team `prad7`. Use Vercel Workflow for orchestration
if ADR-0004's deployed spike passes, and a selected Marketplace Postgres provider
for application truth. Link to it from the portfolio only after Phase 5 approval.

## Consequences

- PaymentLab receives independent preview/production configuration and rollback.
- A new Vercel project, database integration, secrets, and stable callback must
  be provisioned and can incur or unlock usage costs.
- Database and workflow regions must be aligned where possible.
- The portfolio requires only a later reviewed case-study/project-link change.

## Verification still required

- Owner authorization to create the cloud resources.
- Database provider/region/plan decision and transaction/connection spike.
- Deployed callback reachability, environment separation, Workflow recovery,
  cost limits, and replay-only rollback.
