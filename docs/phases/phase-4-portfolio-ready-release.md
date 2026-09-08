# Phase 4 — portfolio-ready release

- Status: not started
- Owner: Pradeep Nair
- Start date: pending Phase 3 gate
- Gate review date: pending
- PRD milestone: Milestone 4
- Applicable acceptance checks: A01-A28

## Outcome

A preview deployment is safe, understandable, measurable, accessible, and ready
for owner review. Sanitized integrated recordings, accurate compatibility labels,
operational controls, and rollback documentation match the running system.

## Entry conditions

- Phase 3 integrated sale and recovery gate passes with no launch-critical unresolved attempt.
- Preview environment, callback, database, workflow, and model limits are measurable.
- Publication remains unauthorized; this phase prepares but does not publish.

## Scope

### Included

- Capture successful, blocked, and uncertain integrated runs; sanitize and version recordings.
- Metrics with population, sample size, source, conditions, and replay/live separation.
- Case study, limitations, architecture summary, accurate ACP label, and attribution.
- Persisted limits, kill switch, retention/cleanup, unresolved diagnostics,
  secret rotation, health checks, security headers, and CSP.
- README, environment guide, migrations, local webhook guide, deployment and incident runbooks.
- Preview accessibility, responsive, performance, privacy, redaction, and compatibility review.
- A portfolio-card proposal only; no portfolio change or merge.

### Explicitly excluded

- Public production publication, DNS changes, portfolio merge, or enabling anonymous live admission.
- Unsupported claims, invented metrics, or removal of product limitations.

## Component changes

| Component | Change | Contract/migration impact | Tests | Documentation updated |
| --- | --- | --- | --- | --- |
| Recordings | Replace release fixtures with sanitized integrated evidence | Recording version bump | Schema/redaction | Replay docs |
| Metrics | Add labeled replay/live measurements | Metrics schema | Accuracy review | Case study |
| Operations | Add persisted controls, health, retention, and diagnostics | Admin/runbook contracts | Recovery/smoke | Runbooks |
| Security layer | Add headers, CSP, rotation checks, and secret scan | Deployment config | Security suite | Threat model |
| Product content | Add limitations, attribution, compatibility, case study | Public copy | Content review | README |
| Preview deployment | Produce reviewable release candidate | Environment/migration record | Full smoke | Release record |

## Flow changes

- Update [architecture](../architecture.md) with deployed environments and operational controls.
- Update [experience flows](../design-flow.md) with final labels, errors, and accessible behavior.
- Update [data flows](../data-flow.md) with recording sanitization and retention.
- Update [data model](../data-model.md) with final migrations and cleanup ownership.
- Resolve every row in [acceptance traceability](../traceability.md).

## Decisions and risks

| Item | Type | Owner | Resolution/evidence |
| --- | --- | --- | --- |
| Recording publication safety | Privacy risk | Pradeep | Automated scan plus human review |
| Metrics interpretation | Product risk | Pradeep | Definitions, denominators, and conditions shown |
| Kill-switch semantics | Reliability risk | Engineering | Stop admission while reconciliation continues |
| Preview-to-public drift | Release risk | Operations | Immutable build and migration record |

## Verification plan

| Check | Layer/environment | Expected result | Evidence |
| --- | --- | --- | --- |
| A01-A28 traceability | Review | Every check passed, intentionally deferred, or owner-blocked | Traceability matrix |
| Recording redaction | Automated/manual | No secrets, tokens, hidden reasoning, or private costs | Scan and approval |
| Preview smoke | Deployed browser | Replay and authorized live scenarios work | Smoke report |
| Accessibility/responsive | Automated/manual | Required journeys pass target standard | Audit evidence |
| Security/privacy | Automated/manual | Headers, CSP, isolation, retention, and secret checks pass | Review report |
| Replay-only rollback | Operational rehearsal | New live admission stops; pending reconciliation continues | Runbook evidence |

## Change log

| Date | Change | Reason | PR/commit | Docs/tests affected |
| --- | --- | --- | --- | --- |
| 2026-09-08 | Created phase packet | Establish Markdown/HTML phase pair before implementation | pending | This record |

## Exit gate review

- [ ] A01-A28 has an explicit evidence-backed disposition.
- [ ] Preview smoke, security, privacy, accessibility, and performance reviews pass.
- [ ] Recordings and metrics are sanitized, versioned, and accurately labeled.
- [ ] Operations, incidents, retention, rotation, and rollback are documented and rehearsed.
- [ ] Portfolio proposal contains no unsupported claim or unrelated change.
- [ ] Owner has reviewed the preview; no public publication is inferred.
- [ ] Markdown and generated HTML phase records match.

## Handoff

Record the immutable release candidate, migration state, operating limits, known
limitations, rollback point, publication approvals still required, and Phase 5 entry conditions.
