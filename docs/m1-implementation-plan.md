# Milestone 1 implementation plan — replay/domain foundation

Date: 2026-09-16
Branch: `feat/m1-replay-domain`
Baseline: `0b75f85df1762bf5b7d9b1e00088754e5f8978b4`
Contracts: PaymentLab AI PRD v1.0; approved M1 boundary from M0.1

## Authority boundary

Implement only deterministic domain/replay behavior and pinned ACP contract-test scaffolding. Use synthetic fixtures. Do not use Stripe, database, workflow, model, or deployment credentials; do not push, open a PR, merge, deploy, or mutate remote resources.

## Traceability

| Work | PRD/phase criteria | Verification |
| --- | --- | --- |
| Integer money and reference quote | A28; Phase 1 exact economics | unit tests for `$303.19`, `$9.09`, `$69.91` |
| Separate state machines and guards | Phase 1 domain foundation | legal/illegal transition tests |
| Versioned events, cursor reducer, projections | A02; ADR-0006 | rewind/future-leakage and unknown-event tests |
| Synthetic recording contract/store | A01, A22 | fixture validation, source label, secret scan |
| Replay-only landing/workspace | A01, A25 | build, browser/keyboard/reduced-motion review |
| ACP 2026-04-17 scaffold | A23 preparation only | vendored hash verification and capability-shape tests |
| Documentation | Phase gate | architecture/data/design/phase/traceability updates and generated HTML check |

## Implementation sequence

1. Add failing focused tests for money, state transitions, replay compatibility/isolation, and ACP pinning.
2. Add pure domain modules and a versioned synthetic recording with deterministic reducer/projections.
3. Add a TypeScript App Router landing page and dynamic replay workspace with accessible controls and responsive views.
4. Vendor only manifest-listed ACP artifacts/license/notice at the pinned commit and add offline contract scaffolding.
5. Update architecture, data model/flow, design flow, traceability, README, and Phase 1 record; regenerate paired HTML.
6. Run focused tests, full tests, docs validation, type/build checks, local browser review, secret scan, and independent code review.
7. Commit reviewable local changes only after verification.

## Rollback

Revert the local feature-branch commits. No migration or remote state exists, and the existing webhook route remains untouched.
