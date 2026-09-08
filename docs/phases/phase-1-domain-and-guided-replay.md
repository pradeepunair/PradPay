# Phase 1 — domain and Guided Replay foundation

- Status: not started
- Owner: Pradeep Nair
- Start date: pending Phase 0 gate
- Gate review date: pending
- PRD milestone: Milestone 1
- Applicable acceptance checks: A01-A10, A18, A22, A25, A28

## Outcome

A public, read-only Guided Replay tells the complete successful purchase story
from Buyer, Merchant, PSP, and synchronized All Views using deterministic
synthetic events. It performs no agent, Stripe, or other external mutation.

## Entry conditions

- Phase 0 permits replay work to proceed even if the live payment path remains blocked.
- Runtime topology, event projection, and physical data choices are accepted or
  narrowly isolated behind documented interfaces.
- The exact economics fixture and six-product fictional catalog are approved.

## Scope

### Included

- Next.js/TypeScript application scaffold and quality gates.
- Integer-minor-unit money and deterministic quote calculations.
- Separate run, checkout, mandate, attempt, order, and webhook state machines.
- Versioned event envelope, reducer, snapshots, explanations, and evidence references.
- Landing page, journey navigation, event rail/drawer, four perspective views,
  replay cursor, speed controls, rewind, and polling-safe read routes.
- Keyboard, focus, screen-reader, reduced-motion, responsive, and mobile behavior.

### Explicitly excluded

- Model-provider calls, live agents, ACP mutations, Stripe calls, and webhooks.
- Real inventory, real customer data, real fulfillment, or real money.

## Component changes

| Component | Change | Contract/migration impact | Tests | Documentation updated |
| --- | --- | --- | --- | --- |
| Web application | Scaffold accessible replay-first shell | Initial routes and build contract | Build, lint, browser | Architecture and design flow |
| Domain core | Add money, quotes, states, and transition guards | Versioned domain types | Unit/property tests | Data model |
| Event/reducer core | Add ordered envelope and deterministic projections | Event schema v1 | Schema and reducer tests | Data flow and ADR-0006 |
| Recording store | Add versioned synthetic manifest and event fixtures | Recording schema v1 | Compatibility tests | Traceability |
| Replay UI | Add perspectives, rail, evidence drawer, and controls | Read-only view models | Browser/accessibility tests | Design flow |

## Flow changes

- Update [architecture](../architecture.md) with the replay-only deployment slice.
- Update [experience flows](../design-flow.md) with keyboard and rewind behavior.
- Update [data flows](../data-flow.md) with recording loading and projection boundaries.
- Update [data model](../data-model.md) with implemented state machines.
- Record event and recording contracts without duplicating them in this packet.

## Decisions and risks

| Item | Type | Owner | Resolution/evidence |
| --- | --- | --- | --- |
| Recording storage/manifest format | Decision | Pradeep | ADR or contract fixture before implementation |
| Replay/live code isolation | Security risk | Engineering | Mutation-free route and dependency tests |
| Future-event leakage during rewind | Correctness risk | Engineering | Cursor projection tests |
| Responsive four-view legibility | Experience risk | Design | Mobile and desktop review |

## Verification plan

| Check | Layer/environment | Expected result | Evidence |
| --- | --- | --- | --- |
| Exact economics fixture | Unit | `$303.19`, `$9.09`, and `$69.91` match PRD | Test output |
| Illegal state transitions | Unit/property | Every forbidden transition fails closed | Test output |
| Recording compatibility | Contract | Known v1 fixtures validate; unknown events are safe | Fixture report |
| Replay mutation isolation | Integration | Replay cannot import or invoke live adapters | Test output |
| Rewind consistency | Browser | No event or total from the future appears | Screenshot/video plus test |
| Keyboard/mobile/reduced motion | Browser/manual | Required journey remains usable | Accessibility evidence |

## Change log

| Date | Change | Reason | PR/commit | Docs/tests affected |
| --- | --- | --- | --- | --- |
| 2026-09-08 | Created phase packet | Establish Markdown/HTML phase pair before implementation | pending | This record |

## Exit gate review

- [ ] Successful Guided Replay is demonstrable in every perspective.
- [ ] Economics, reducers, transitions, and recording compatibility tests pass.
- [ ] Rewind exposes no future event or derived value.
- [ ] Replay routes cannot invoke live agents or payment mutations.
- [ ] Applicable A01-A28 rows link repeatable evidence.
- [ ] Architecture, design flow, data flow, and data model match the increment.
- [ ] Accessibility and responsive review pass.
- [ ] Markdown and generated HTML phase records match.

## Handoff

Record the accepted event/recording versions, fixture provenance, open defects,
safe rollback point, and exact Phase 2 entry conditions.
