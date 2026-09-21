# ADR-0003: Stripe test credential and ACP payment-handler path

- Status: proposed and blocked; historical sandbox observation is not current candidate evidence
- Date: 2026-09-08
- Owner/reviewer: Pradeep Nair / pending

## Context

ACP completion expects negotiated payment data. Stripe documents Shared Payment
Tokens (SPTs), including a test helper that simulates a granted SPT and a
PaymentIntent confirmation using that SPT, but labels agentic commerce/SPT as
private preview. A 2026-09-08 historical observation found a dedicated `PradPay
sandbox` with no API activity or event destination. It was not freshly account-read
for this candidate, and dashboard access did not prove SPT entitlement.

## Options considered

1. Actual supported SPT test-helper path mapped to the pinned ACP handler.
2. Another documented handler/credential path allowed by the pinned schema.
3. ACP checkout subset plus a clearly separate custom Stripe sandbox completion.
4. Replay-only release until an account-supported path exists.

## Proposed decision

Prefer option 1 only if the intended Stripe sandbox/test account successfully
creates an SPT through the documented test helper and uses it for one tiny
automatic-capture PaymentIntent. Otherwise choose the narrowest verified
alternative and use the exact PRD-required compatibility label. Never construct
an `spt_` value or substitute a PaymentMethod ID.

## Ordered external packages (all currently blocked)

1. Capability-only spike: after owner-controlled rotation and approved secret
   custody, call the documented SPT test helper with an explicitly pinned API
   version. Do not create a PaymentIntent, destination, or deployment in this step.
2. Environment/callback package: only after a reviewed capability result and new
   approval, map an exact staged build to a stable HTTPS endpoint, then register
   the minimum event allowlist and verify a provider-signed callback.
3. One-payment package: only after E03-E08 are accepted and immediate payment
   authorization, create one USD 1.00 fictional automatic-capture test payment
   with a stable idempotency key and confirm no live-mode object or real money.
4. Uncertain-response package: only if separately approved after the bounded sale,
   suppress one test response and prove same-attempt reconciliation.

## Consequences

The ADR cannot be accepted from documentation alone. Until the spike passes,
Phase 1 replay can proceed but Phase 3 Live Sandbox completion remains blocked.

## M3.1 gate disposition

The local synthetic foundation at
`b9a480c353a7123c4680aec3ed5b442c8ceaa821` passed bounded QA. That result does
not satisfy M3-E03 through M3-E08, accept this ADR, establish account capability,
or authorize a payment handler. Complete checkout and delegate payment remain
hard-blocked, and advertised payment handlers remain empty.

The first step that requires Stripe credentials is the authenticated capability
spike: calling the documented Stripe test helper in the explicitly approved
sandbox to determine whether that account supports SPT/delegate payment. Key
rotation and secret-store placement happen before that call, but the replacement
value must never enter Git, chat, documentation, logs, fixtures, or model context.

Before the credentialed call, the evidence packet must contain:

1. Pete/Product's written authorization for the bounded capability question and
   accepted fallback outcomes.
2. Prads/account-owner approval of the exact sandbox/profile, pinned API version,
   allowed read/mutation scope, zero-payment capability-spike budget, operator,
   start/stop window, and rollback/cleanup owner.
3. Account-owner confirmation that the exposed test secret was rotated and the
   replacement is held only in an approved secret store; record confirmation and
   timestamp, never the value.
4. A named isolated staging/callback target if the spike expands beyond the
   entitlement call. That expansion requires a new approval before destination
   registration, deployment, or any payment mutation.

## Decision tree

- If the authenticated test helper proves supported SPT/delegate-payment
  capability, attach redacted provider evidence and return this ADR for Product
  and engineering review. Do not mark accepted automatically.
- If the account returns a documented unsupported/entitlement result, preserve
  the redacted result and ask Product to choose a truthful replay-only or separate
  custom-completion label.
- If the result is ambiguous, stop. Do not invent a token, substitute a
  PaymentMethod ID, change API versions opportunistically, or attempt a payment.
- Any payment, webhook destination, hosted resource, or deployment is a later,
  separately approved package after M3-E03 through M3-E08 are reviewed.

## Evidence placeholders

Use `docs/m3-external-evidence-template.md`. The preparation-only approval request
is `docs/m3-stripe-capability-spike-approval-packet.md`; its incomplete fields do
not authorize credential access or execution. Store only redacted references,
timestamps, approved identifiers, mode/version assertions, response class, and
reviewer disposition. Never store credentials, complete provider payloads,
reusable tokens, client secrets, webhook signing secrets, or customer data.

## Rollback and safe default

Before an approved call, disable admission and confirm zero in-flight operations.
If the spike fails or evidence is incomplete, revoke/rotate any temporary access,
remove only explicitly created test artifacts, retain a redacted audit reference,
and return to replay-only behavior. Payment handlers stay empty and this ADR stays
proposed/blocked until reviewers explicitly accept a verified path.
