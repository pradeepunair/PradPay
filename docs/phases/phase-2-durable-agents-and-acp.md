# Phase 2 — durable agents and ACP checkout

- Status: not started
- Owner: Pradeep Nair
- Start date: pending Phase 1 gate
- Gate review date: pending
- PRD milestone: Milestone 2
- Applicable acceptance checks: A02-A12, A18-A21, A23-A27

## Outcome

Bounded Buyer and Merchant agents create a server-validated ACP checkout and the
durable workflow pauses at explicit purchase authority. No path can dispatch a
payment during this phase.

## Entry conditions

- Phase 1 event, projection, and state contracts are accepted.
- ACP `2026-04-17` artifacts and compatibility boundary remain pinned.
- Workflow, database, and model-provider spikes pass their required Phase 0 gates.
- Server-side agent role and tool boundaries are approved.

## Scope

### Included

- Opaque sessions, run ownership, CSRF/origin checks, atomic admission limits,
  reconnect, and expiration.
- Durable workflow, transactional outbox, retries, leases/fencing, event sequence,
  and permission wait/resume.
- Separate Buyer/Merchant prompts, structured outputs, role tool allowlists,
  budgets, validation, and safe execution records.
- Merchant catalog, stock, offer, quote, and reservation services.
- Pinned ACP server surface, client adapter, authentication, version mapping,
  run scoping, generated types, fixtures, and contract tests.
- Mission normalization, explicit confirmation, grant/revise/revoke/expire flows,
  and atomic authority reservation.
- SSE committed-event stream with cursor catch-up and polling fallback.

### Explicitly excluded

- Stripe credential setup, PaymentIntent creation, or any PSP mutation.
- Order confirmation or claims of payment success.
- Broader ACP operations beyond the documented MVP subset.

## Component changes

| Component | Change | Contract/migration impact | Tests | Documentation updated |
| --- | --- | --- | --- | --- |
| Session/run API | Add ownership and admission boundary | Session/run API v1 | Security/integration | Architecture and threat model |
| Workflow/outbox | Add durable orchestration and permission hook | Workflow/event migrations | Recovery tests | Data flow and ADR-0004 |
| Agent adapters | Add isolated Buyer/Merchant tool loops | Prompt/tool schema versions | Adversarial tests | Agent contract record |
| Merchant services | Add deterministic catalog through reservation | Domain service contracts | Unit/integration | Data model |
| ACP adapter/server | Implement pinned checkout subset | ACP `2026-04-17` types/routes | Contract tests | ACP compatibility |
| Consent gate | Add mandate lifecycle and atomic reservation | Mandate tables/states | Race/expiry tests | Design and data flows |
| Event feed | Add SSE plus catch-up/poll fallback | Projection/cursor contract | Reconnect tests | Architecture |

## Flow changes

- Update [architecture](../architecture.md) with workflow, agent, tool, ACP, and consent boundaries.
- Update [experience flows](../design-flow.md) for mission confirmation and mandate lifecycle.
- Update [data flows](../data-flow.md) for outbox dispatch, waits, and committed event streaming.
- Update [data model](../data-model.md) for sessions, runs, reservations, mandates, and executions.
- Complete the non-payment sections of [ACP compatibility](../acp-compatibility.md).

## Decisions and risks

| Item | Type | Owner | Resolution/evidence |
| --- | --- | --- | --- |
| Model/provider selection | Decision | Pradeep | Accept ADR-0005 after spike |
| Agent prompt injection | Security risk | Engineering | Role allowlists plus adversarial suite |
| Workflow replay/version drift | Reliability risk | Engineering | Suspended-run deployment test |
| Duplicate run/grant races | Correctness risk | Engineering | Transactions, uniqueness, and concurrency tests |

## Verification plan

| Check | Layer/environment | Expected result | Evidence |
| --- | --- | --- | --- |
| Cross-session access | Integration | No read, stream, or mutation crosses ownership | Test output |
| Admission and grant races | Integration | Limits and one authority reservation remain atomic | Concurrency report |
| Workflow crash/reconnect | Deployed spike | Resume from committed state without duplicate effects | Workflow evidence |
| Agent tool isolation | Agent/security | Buyer and Merchant cannot invoke the other's tools | Adversarial report |
| ACP request/response contracts | Contract | Implemented subset matches pinned schemas | Contract report |
| No-payment boundary | Static/integration | No Phase 2 route or tool can reach PSP submission | Test output |

## Change log

| Date | Change | Reason | PR/commit | Docs/tests affected |
| --- | --- | --- | --- | --- |
| 2026-09-08 | Created phase packet | Establish Markdown/HTML phase pair before implementation | pending | This record |

## Exit gate review

- [ ] Agents reach a validated, reserved, versioned ACP checkout.
- [ ] Workflow pauses and resumes durably at permission.
- [ ] Session, run, role, and tool isolation tests pass.
- [ ] ACP compatibility claims match contract evidence.
- [ ] No code path can dispatch a payment.
- [ ] Applicable A01-A28 rows link repeatable evidence.
- [ ] Component, flow, contract, and threat-model documents are current.
- [ ] Markdown and generated HTML phase records match.

## Handoff

Record accepted prompt/tool/ACP versions, suspended workflows, open defects,
rollback instructions, and the exact Phase 3 payment enablement conditions.
