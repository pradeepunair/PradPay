# Phase 3 — Stripe test sale and resilient recovery

- Status: local synthetic foundation QA-passed; external entry gates blocked and Phase 3 unaccepted
- Owner: Pradeep Nair
- Start date: pending Phase 2 gate and Stripe capability approval
- Gate review date: 2026-09-21 (`M3-GATE-DOC-001`)
- PRD milestone: Milestone 3
- Applicable acceptance checks: A04, A07-A18, A20-A24, A26-A28

## Outcome

One explicitly authorized mandate produces at most one Stripe test-mode sale and
one confirmed order. Refusal, duplicate, crash, callback-ordering, and ambiguous
response paths remain safe and visibly evidence-grounded.

The exact local baseline
`b9a480c353a7123c4680aec3ed5b442c8ceaa821` passed Tab's bounded synthetic QA.
This is implementation foundation evidence only: E03-E08 remain blocked or
partial, E09 is local-only, and every X-gate remains externally unaccepted. No
Stripe call, provider-signed callback, hosted runtime, deployment, payment, or
Product acceptance is claimed. ADR-0003 remains proposed and blocked.

## Entry conditions

- Phase 2 authority reservation and no-payment boundary pass.
|- ADR-0003 is proposed/blocked; a separately authorized authenticated Stripe test-account spike is required before Phase 3 implementation.
- Stable test callback, secret ownership, rotation, and environment checks exist.
- Kill switch and budgets preserve reconciliation of submitted attempts.

## Scope

### Included

- Stripe-hosted test payment setup with explicit setup consent and backend-held references.
- Atomic mandate reservation plus stable order, payment, and attempt records before submission.
- Automatic-capture test submission with deterministic idempotency key and request hash.
- Raw-body signature verification, durable receipt, deduplication, asynchronous apply,
  and out-of-order tolerance.
- Unknown-state reconciliation by known provider reference or safe same-key recovery.
- Allowlisted uncertain-response injection after a real test mutation.
- Clear unresolved, requires-action, failed, and confirmed experience states.

### Explicitly excluded

- Live-mode keys, real money, real identities, refunds, disputes, subscriptions,
  payouts, multi-PSP routing, or real fulfillment.
- Confirmation based only on model text, redirect state, or unverified browser input.

## Component changes

| Component | Change | Contract/migration impact | Tests | Documentation updated |
| --- | --- | --- | --- | --- |
| Payment setup | Add consented Stripe test credential flow | Payment reference contract | Browser/integration | Design and ACP compatibility |
| Payment gate | Add atomic dispatch fencing | Mandate/attempt migrations | Race tests | Data model |
| Stripe adapter | Add stable submission and lookup/recovery | Provider adapter v1 | Integration | ADR-0003 |
| Webhook endpoint | Add raw verification and durable receipt | Receipt schema | Signature/order tests | Data flow and runbook |
| Reconciler | Add unknown-state recovery horizon | Attempt transitions/jobs | Crash/timeout tests | Architecture |
| Evidence projection | Add verified payment/order evidence | Safe event fields | Redaction tests | ADR-0006 |

## Flow changes

- Update [architecture](../architecture.md) with Stripe, webhook, and reconciliation paths.
- Update [experience flows](../design-flow.md) for setup consent and unresolved outcomes.
- Update [data flows](../data-flow.md) for submission, callback, lookup, and same-key recovery.
- Update [data model](../data-model.md) with physical payment constraints and transitions.
- Complete the payment section and approved label in [ACP compatibility](../acp-compatibility.md).

## Decisions and risks

| Item | Type | Owner | Resolution/evidence |
| --- | --- | --- | --- |
| ACP/Stripe credential path | Decision | Pradeep | Accepted ADR-0003 and test evidence |
| Double submission | Critical risk | Engineering | Atomic fencing, uniqueness, provider idempotency |
| Unknown provider outcome | Critical risk | Engineering | No new attempt; lookup/same-key reconciliation |
| Forged/duplicate webhook | Security risk | Engineering | Signature verification and unique provider event ID |
| Test/live confusion | Security risk | Operations | Fail-closed startup and object-mode assertions |

## Verification plan

| Check | Layer/environment | Expected result | Evidence |
| --- | --- | --- | --- |
| Unauthorized submission | Integration | Zero Stripe submission calls | Test output |
| Concurrent completion | Integration | One attempt and at most one successful charge | Concurrency report |
| Invalid/duplicate callback | Integration | Invalid rejected; duplicate has one business effect | Webhook report |
| Callback before API response | Integration | Terminal truth is monotonic and evidence-backed | Event trace |
| Timeout/unknown recovery | Fault-injection | Reconcile without creating a new attempt | Provider-safe trace |
| Real test sale | Deployed smoke | One tiny test payment and confirmed order | Redacted evidence reference |

## Change log

| Date | Change | Reason | PR/commit | Docs/tests affected |
| --- | --- | --- | --- | --- |
| 2026-09-08 | Created phase packet | Establish Markdown/HTML phase pair before implementation | pending | This record |

## Exit gate review

- [ ] One mandate yields at most one successful test payment and confirmed order.
- [ ] Invalid authority cannot reach Stripe.
- [ ] Callback and provider lookup are the only confirmation evidence sources.
- [ ] Unknown outcomes reconcile without a new attempt.
- [ ] Crash, duplicate, ordering, and signature tests pass.
- [ ] Applicable A04, A07-A18, A20-A24, and A26-A28 rows link repeatable, redacted evidence.
- [ ] Runbook, diagrams, contracts, threat model, and compatibility label are current.
- [ ] Markdown and generated HTML phase records match.

## Handoff

Record safe Stripe references, unresolved attempts, reconciliation ownership,
credential rotation status, rollback-to-replay procedure, and Phase 4 entry conditions.
