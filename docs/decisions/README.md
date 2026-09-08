# Architecture decision records

Create one numbered file per consequential decision, for example
`0001-runtime-topology.md`. ADRs are immutable after acceptance except for status
and links; superseding decisions get a new number.

Required before Phase 0 closes:

- 0001 — runtime and deployment topology
- 0002 — pinned ACP revision and compatibility boundary
- 0003 — Stripe test credential/payment-handler path
- 0004 — durable workflow and transactional dispatch

Likely early decisions:

- 0005 — model provider and structured-tool contract
- 0006 — event schema, projection, and redaction policy
- 0007 — physical database schema and typed ORM

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
