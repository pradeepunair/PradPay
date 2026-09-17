# Phase 0 — capability and architecture decisions

- Status: active
- Owner: Pradeep Nair
- Start date: 2026-09-08
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

- [x] Confirm the implementation repository and default-branch workflow.
- [x] Confirm the portfolio repository/framework and desired integration point.
- [x] Confirm the Vercel owner/team, project naming, environment separation, and
      whether preview callbacks can be public without weakening unrelated protection.
- [ ] Identify available managed Postgres and durable workflow resources. Vercel
      Workflow is visible on the verified Hobby team; no database exists yet.
- [ ] Record current plan limits and cost-bearing services without calling them free.
      Vercel Hobby Workflow allowances are recorded; database/model/Stripe costs remain.

### ACP

- [x] Identify an upstream released revision, schema hash, changelog, and license.
- [x] Validate the pinned upstream schemas/examples in a disposable checkout.
- [x] Verify the protocol's version header, bearer-auth boundary, capability
      negotiation shape, and payment-handler schema. Account support is separate.
- [ ] Generate PaymentLab request/response types and contract fixtures.
- [ ] Complete the payment section of the [ACP compatibility record](../acp-compatibility.md).

### Stripe test payment

- [ ] Verify test-mode account and supported hosted/payment credential path.
- [x] Choose a small fictional quote and stable operation/idempotency identity.
- [ ] Create exactly one test payment through a supported path.
- [ ] Receive, signature-verify, deduplicate, and safely record its callback.
- [ ] Remove or retain spike resources according to the documented test policy.
- [ ] Record only safe provider references and redacted evidence.

The dedicated `PradPay sandbox` and Workbench are verified. No API activity or
event destination exists. The existing standard test secret was exposed through
browser accessibility output and must be rotated before use. SPT entitlement is
still unverified because it requires a controlled test-helper API call.

The 2026-09-09 Stripe destination selector exposed the documented granted-token
deactivation event but not `shared_payment.granted_token.used`; an exact search
returned no result. The available agent-side issued-token event is not an
equivalent seller event and was not selected. The destination form is prepared
with the five required PaymentIntent events plus granted-token deactivation but
has not been submitted. The SPT helper call remains the capability gate.

The approved spike fixture is fictional and test-only: operation
`phase0-spt-spike-001`, seller/cart reference `pradpay-phase0-cart-001`, USD 1.00
(`100` cents), and idempotency key `pradpay:phase0:spt-payment:v1`. The SPT expiry
must be calculated as 15 minutes after the helper request; it must not be a
checked-in timestamp. Retrying the one permitted PaymentIntent must reuse the
same idempotency key rather than create another payment.

### Durable execution

- [x] Verify Vercel Workflow dashboard availability in the intended team scope.
- [ ] Evaluate Vercel Workflow against actual account limits and deployed behavior.
- [ ] If unsuitable, evaluate a persisted queue plus independently reliable worker.
- [ ] Prove durable sleep/wait, retry, crash recovery, callback wake-up/polling,
      one committed dispatch, and continued execution without a browser.
- [ ] Record operations, monitoring, failure modes, cost, and rollback ownership.

### Model provider

- [ ] Verify structured tool/schema support, model identifier/version behavior,
      rate/usage reporting, timeout handling, data policy, and cost configuration.
- [ ] Prove separate Buyer/Merchant allowlists can be enforced server-side.

The Vercel AI Gateway is available but unconfigured and requires an API key plus
billing-card setup. Direct-provider access has not been verified. No provider is
selected yet.

### Security and privacy

- [x] Create the initial threat model for session theft/fixation, cross-run access, CSRF/origin, prompt
      injection, tool escalation, SSRF, secret leakage, webhook forgery, replay
      publication, log access, and denial-of-wallet.
- [ ] Define secret ownership/rotation and test/live fail-closed checks.
- [ ] Define event, log, transcript, recording, and unresolved-payment retention.

## Required decisions

| ADR | Decision | Status | Verification required |
| --- | --- | --- | --- |
| 0001 | Runtime/deployment topology | proposed | Real project/resource inventory and callback reachability |
| 0002 | ACP revision and compatibility | accepted | Pinned artifacts plus upstream schema/example validation |
| 0003 | Stripe credential/payment-handler path | pending | One supported test payment and verified callback |
| 0004 | Durable workflow/outbox | proposed | Wait/retry/crash/dispatch recovery proof |
| 0005 | Model provider/tool contract | pending | Structured-tool and usage/error spike |
| 0006 | Event projection/redaction | proposed | Safe sample events and publication review |
| 0007 | Database and typed ORM | proposed | Authorized Neon resource plus transaction/migration/restore spike |

## Evidence register

| Evidence | Environment | Safe artifact/link | Result | Reviewer/date |
| --- | --- | --- | --- | --- |
| Repository/platform inventory | Local repositories + Vercel `prad7` | `docs/phase-0-environment-inventory.md` | partial; cloud resources still required | Codex / 2026-09-08 |
| ACP schema/contract spike | Temporary upstream checkout | `protocol/acp/manifest.json`; `docs/acp-compatibility.md` | protocol snapshot passed | Codex / 2026-09-08 |
| Stripe account readiness | Authenticated `PradPay sandbox` | `docs/phase-0-environment-inventory.md` | partial; key rotation, callback, and SPT API test required | Codex / 2026-09-08 |
| Phase HTML review | Local-only browser preview | `docs/phases/index.html`; all generated phase pages | passed; full Phase 0 page and shared navigation visually reviewed | Codex / 2026-09-08 |
| Local webhook boundary | Next.js route plus synthetic signed-event tests | `app/api/webhooks/stripe/route.js`; `test/stripe-webhook.test.mjs` | passed locally; durable receipt and provider-signed event remain pending | Codex / 2026-09-08 |
| Public HTTPS callback deployment | Isolated Vercel project `prad7/pradpay` | `https://pradpay.vercel.app/api/webhooks/stripe` | deployed; returns `503` fail-closed until endpoint signing secret is configured | Codex / 2026-09-09 |
| SPT event selector compatibility | `PradPay sandbox`, API `2026-08-26.dahlia` | Prepared Stripe destination form; no secret captured | partial blocker; granted-token deactivation available, granted-token used unavailable | Codex / 2026-09-09 |
| Stripe test payment | — | — | pending | — |
| Verified webhook callback | — | — | pending | — |
| Durable workflow recovery spike | — | — | pending | — |
| Model structured-tool spike | — | — | pending | — |
| Threat model | Design review | `docs/threat-model.md` | initial model complete; revisit after spikes | Codex / 2026-09-08 |

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

### Documentation parity

- [x] Markdown and generated HTML phase records match and HTML is visually reviewed.
