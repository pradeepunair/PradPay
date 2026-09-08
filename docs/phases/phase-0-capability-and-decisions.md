# Phase 0 — capability and architecture decisions

- Status: not started
- Owner: Pradeep Nair
- Start date: pending
- Gate review date: pending
- PRD milestone: Milestone 0
- Applicable acceptance checks: A15, A20, A23, A24, A26, A27 (discovery or spike coverage)

## Outcome

A verified implementation boundary for ACP, Stripe test payments, durable
execution, Postgres, Vercel, the model provider, and portfolio integration—plus a
minimal supported Stripe test payment and signature-verified callback, or a
specific documented blocker that leaves Guided Replay unblocked.

## Entry conditions

- Repository and any repository-local instructions are available.
- Owner can identify or authorize read-only inspection of relevant Vercel,
  Stripe, model-provider, database, and portfolio resources.
- The spike is constrained to test mode, fictional data, a tiny amount, and an
  isolated callback endpoint.
- No publication, DNS, portfolio merge, or unrelated account change is implied.

## Discovery checklist

### Repository and delivery

- [ ] Confirm the implementation repository and default-branch workflow.
- [ ] Confirm the portfolio repository/framework and desired integration point.
- [ ] Confirm the Vercel owner/team, project naming, environment separation, and
      whether preview callbacks can be public without weakening unrelated protection.
- [ ] Identify available managed Postgres and durable workflow resources.
- [ ] Record current plan limits and cost-bearing services without calling them free.

### ACP

- [ ] Identify an upstream released revision, schema hash, changelog, and license.
- [ ] Generate/validate exact request and response types in a disposable spike.
- [ ] Verify version headers, auth, capability negotiation, and payment handlers.
- [ ] Complete the [ACP compatibility record](../acp-compatibility.md).

### Stripe test payment

- [ ] Verify test-mode account and supported hosted/payment credential path.
- [ ] Choose a small fictional quote and stable operation/idempotency identity.
- [ ] Create exactly one test payment through a supported path.
- [ ] Receive, signature-verify, deduplicate, and safely record its callback.
- [ ] Remove or retain spike resources according to the documented test policy.
- [ ] Record only safe provider references and redacted evidence.

### Durable execution

- [ ] Evaluate Vercel Workflows against actual account availability and limits.
- [ ] If unsuitable, evaluate a persisted queue plus independently reliable worker.
- [ ] Prove durable sleep/wait, retry, crash recovery, callback wake-up/polling,
      one committed dispatch, and continued execution without a browser.
- [ ] Record operations, monitoring, failure modes, cost, and rollback ownership.

### Model provider

- [ ] Verify structured tool/schema support, model identifier/version behavior,
      rate/usage reporting, timeout handling, data policy, and cost configuration.
- [ ] Prove separate Buyer/Merchant allowlists can be enforced server-side.

### Security and privacy

- [ ] Threat-model session theft/fixation, cross-run access, CSRF/origin, prompt
      injection, tool escalation, SSRF, secret leakage, webhook forgery, replay
      publication, log access, and denial-of-wallet.
- [ ] Define secret ownership/rotation and test/live fail-closed checks.
- [ ] Define event, log, transcript, recording, and unresolved-payment retention.

## Required decisions

| ADR | Decision | Status | Verification required |
| --- | --- | --- | --- |
| 0001 | Runtime/deployment topology | pending | Real project/resource inventory and callback reachability |
| 0002 | ACP revision and compatibility | pending | Pinned artifacts plus contract spike |
| 0003 | Stripe credential/payment-handler path | pending | One supported test payment and verified callback |
| 0004 | Durable workflow/outbox | pending | Wait/retry/crash/dispatch recovery proof |
| 0005 | Model provider/tool contract | pending | Structured-tool and usage/error spike |
| 0006 | Event projection/redaction | pending | Safe sample events and publication review |

## Evidence register

| Evidence | Environment | Safe artifact/link | Result | Reviewer/date |
| --- | --- | --- | --- | --- |
| Repository/platform inventory | — | — | pending | — |
| ACP schema/contract spike | — | — | pending | — |
| Stripe test payment | — | — | pending | — |
| Verified webhook callback | — | — | pending | — |
| Durable workflow recovery spike | — | — | pending | — |
| Model structured-tool spike | — | — | pending | — |
| Threat model | — | — | pending | — |

## Gate decision

Choose exactly one:

- [ ] **Pass — integrated live path:** supported ACP checkout/payment boundary is
      verified and Phases 1-3 may proceed.
- [ ] **Pass with labeled extension:** ACP checkout subset is verified and custom
      Stripe completion is explicitly separated and approved.
- [ ] **Replay-only continuation:** live completion is blocked; Phase 1 proceeds
      and the dependency is recorded with a re-entry condition.
- [ ] **Blocked:** a dependency prevents both the live spike and replay foundation.

Before closing, add Phase 1-5 estimates based on verified scope and capacity;
update architecture/data-flow diagrams; link accepted ADRs; and record every
unresolved assumption, cost, and owner authorization needed next.
