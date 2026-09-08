# Architecture decision records

Create one numbered file per consequential decision, for example
`0001-runtime-topology.md`. ADRs are immutable after acceptance except for status
and links; superseding decisions get a new number.

## Decision register

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-runtime-topology.md) | Proposed | Separate Vercel application with durable execution and Postgres |
| [0002](0002-acp-version.md) | Accepted | Pin ACP `2026-04-17` at an exact upstream commit |
| [0003](0003-stripe-payment-path.md) | Proposed; account spike blocked | Stripe test credential and ACP payment-handler path |
| [0004](0004-durable-workflow.md) | Proposed | Vercel Workflow subject to a deployed durability spike |
| [0005](0005-model-provider.md) | Proposed | Model provider and structured-tool boundary |
| [0006](0006-event-projection-and-redaction.md) | Proposed | Append-only safe events with authorized projections |
| [0007](0007-database-and-orm.md) | Proposed | Neon Postgres with Prisma ORM, subject to resource spike |

## ADR template

```markdown
# ADR-NNNN: Decision title

- Status: proposed | accepted | superseded | rejected
- Date: YYYY-MM-DD
- Owners/reviewers:
- Supersedes/superseded by:

## Context

What requirement, constraint, or verified environment fact requires a decision?

## Decision drivers

- Correctness/security/reliability needs
- Delivery and operational constraints
- Verified capabilities and limits

## Options considered

Describe viable options, including doing less. Record evidence rather than
marketing claims.

## Decision

State the boundary and the selected option precisely.

## Consequences

List benefits, costs, risks, operational ownership, migration/rollback, and what
must be revisited at growth.

## Verification

Link safe spike output, contract tests, provider documentation, or account facts.
Do not include secrets or full sensitive payloads.
```
