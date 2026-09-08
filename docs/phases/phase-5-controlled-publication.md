# Phase 5 — controlled public publication

- Status: not started
- Owner: Pradeep Nair
- Start date: pending Phase 4 gate and explicit owner approval
- Gate review date: pending
- PRD milestone: Portfolio release
- Applicable acceptance checks: A01-A28 plus release smoke and rollback

## Outcome

The approved PaymentLab release is publicly reachable, the portfolio links to it,
the stable Stripe test callback works, operating controls are active, and a tested
replay-only rollback remains available.

## Entry conditions

- Phase 4 release candidate and full evidence review pass.
- Owner explicitly approves publication, domain/DNS change, portfolio change,
  live-admission setting, and operating limits.
- There are no unresolved launch-critical payment attempts.
- Exact Vercel, Stripe, GitHub, portfolio, and DNS targets are reverified.

## Scope

### Included

- Promote the reviewed compatible build and migrations in the verified Vercel scope.
- Configure only approved demo-domain records while preserving apex, `www`, email,
  verification, and unrelated DNS records.
- Configure and verify the stable Stripe test webhook endpoint.
- Apply the separately reviewed portfolio project/case-study link through branch,
  PR, preview, and merge workflow.
- Test public replay, authorized live access, isolation, TLS, DNS, streaming/poll
  fallback, metrics labels, and case-study/source links.
- Monitor initial runs and retain reconciliation-safe replay-only rollback.

### Explicitly excluded

- Any unrelated portfolio, DNS, email, verification, or production-payment change.
- Live-mode Stripe, real fulfillment, silent limit increases, or inferred publication authority.

## Component changes

| Component | Change | Contract/migration impact | Tests | Documentation updated |
| --- | --- | --- | --- | --- |
| Vercel release | Promote approved build and migrations | Release manifest | Public smoke | Release record |
| Domain/DNS | Add only approved demo records | DNS/TLS target | DNS/TLS checks | Runbook |
| Stripe webhook | Point test endpoint to stable callback | Endpoint secret rotation | Signed callback smoke | Operations docs |
| Portfolio | Add approved link/case-study card | Separate repository PR | Preview/live link checks | Portfolio evidence |
| Monitoring | Enable launch observation and alerts | Alert ownership | Initial-run checks | Incident runbook |
| Admission control | Apply approved live/replay setting and budgets | Runtime configuration | Kill-switch test | Operations docs |

## Flow changes

- Update [architecture](../architecture.md) with final public endpoints and ownership.
- Update [experience flows](../design-flow.md) with public/replay/live availability.
- Update [data flows](../data-flow.md) with stable callback and monitoring boundaries.
- Update [acceptance traceability](../traceability.md) with public smoke evidence.
- Record the portfolio PR, preview, merge, and release identifiers without secrets.

## Decisions and risks

| Item | Type | Owner | Resolution/evidence |
| --- | --- | --- | --- |
| Publication authorization | Required decision | Pradeep | Explicit approval at action time |
| DNS target scope | Operational risk | Pradeep | Read-only inventory and exact-record change plan |
| Launch abuse/cost | Operational risk | Operations | Budgets, admission limits, alerts, kill switch |
| Pending payment during rollback | Reliability risk | Engineering | Reconciliation remains enabled |

## Verification plan

| Check | Layer/environment | Expected result | Evidence |
| --- | --- | --- | --- |
| DNS and TLS | Public | Approved hostname resolves with valid TLS | Check output |
| Public Guided Replay | Browser | Stable, read-only, accessible journey | Smoke report |
| Authorized Live Sandbox | Browser/integration | Test-only bounded run or intentionally disabled label | Smoke report |
| Session isolation | Public security | Cross-session access remains denied | Test output |
| Stable webhook | Stripe test | Signed callback reaches correct environment once | Redacted evidence |
| Replay-only rollback | Operational | Admission stops; submitted attempts still reconcile | Rehearsal report |
| Portfolio link | Browser | Reviewed link and claims match released artifact | Preview/public evidence |

## Change log

| Date | Change | Reason | PR/commit | Docs/tests affected |
| --- | --- | --- | --- | --- |
| 2026-09-08 | Created phase packet | Establish Markdown/HTML phase pair before implementation | pending | This record |

## Exit gate review

- [ ] Owner approved publication and exact external changes.
- [ ] Public journey, DNS, TLS, callback, isolation, and fallback smoke checks pass.
- [ ] Operating limits, monitoring, and incident ownership are active.
- [ ] No unresolved launch-critical attempt exists.
- [ ] Portfolio link and public claims match verified evidence.
- [ ] Replay-only rollback is tested and preserves reconciliation.
- [ ] Markdown and generated HTML phase records match.

## Handoff

Record release identifiers, owner approvals, monitoring window, known limitations,
open non-critical issues, operational ownership, and the safe rollback point.
