# M3 Stripe capability-spike preflight evidence

Status: `STOPPED BEFORE CREDENTIAL BOUNDARY`

Preflight timestamp: `2026-09-21T11:49:21-05:00`

Preparation candidate: `6eefb4524e7cbfe323b83e570195e43c6cfdd17a`

Approval packet: `docs/m3-stripe-capability-spike-approval-packet.md`

No credential was requested, retrieved, injected, displayed, or used. No Stripe API
request, webhook destination, deployment, hosted-resource mutation, payment, push,
PR, merge, or production action occurred.

## Authority received

Hermes reported written user approval for this bounded scope:

- Dedicated Stripe test account/profile; exact identifier must not be guessed.
- Stripe API `2026-08-26.dahlia`.
- ACP `2026-04-17`.
- One capability-helper request.
- Zero payments and USD 0.00.
- Riley as operator and Emily as reviewer.
- Maximum 30-minute window.
- Provider-documented cleanup only.
- No retry and all packet stop conditions.
- No webhook destination, deployment, hosted resource, payment, push, PR, merge,
  production action, or other external mutation.

Hermes also reported user attestation that the previously exposed test secret was
rotated and the replacement is in approved custody. No secret value or secret-store
content was inspected during preflight.

This authority is necessary but not sufficient to cross the credential boundary:
the final read-back still requires the exact non-secret account/profile identifier,
an exact active start/end window, and a helper request whose complete prerequisites
are inside the approved scope.

## Repository and packet read-back

- Worktree HEAD at preflight start:
  `6eefb4524e7cbfe323b83e570195e43c6cfdd17a`.
- Branch: `docs/m3-stripe-capability-spike-prep`.
- Packet SHA-256:
  `ef7f021a60bdbc9462300738948801ff7bdb47855774c734b674fb975e62c3a2`.
- ADR-0003 SHA-256:
  `e17e88757aa259d348bd3b9bdcd27a7c4dae15b48666156460b35a2a10cbc000`.
- ADR-0003 remains proposed/blocked.
- Packet lines 78-79 still contain `[OWNER-CONFIRMED VALUE]` for the non-secret
  account reference and profile/team/organization owner.
- Packet line 189 still contains `[APPROVED VALUE]` for the exact approved
  sandbox/account/profile.
- Packet lines 140-141 and 196 still contain placeholders rather than an exact
  active start/end window.
- Packet approval and attestation fields remain placeholders. The written approval
  and high-level rotation/custody attestation were delivered through Hermes, but
  the exact identifier/window fields needed for final read-back were not supplied.

Result: account/profile identity and active window cannot be verified without
inventing values. Packet stop conditions require stopping before credential access.

## Official documentation verification

Primary official sources inspected without authentication:

1. Stripe, "Create a test SharedPaymentGrantedToken":
   `https://docs.stripe.com/api/shared-payment/granted-token/create.md?api-version=2026-08-26.dahlia`
2. Stripe, "Shared Payment Granted Tokens":
   `https://docs.stripe.com/api/shared-payment/granted-token.md?api-version=2026-08-26.dahlia`
3. Stripe Dahlia changelog evidence for the exact request-version header:
   `https://docs.stripe.com/changelog/dahlia/2026-08-26/customer-session-improvements`

Verified documentary facts:

- The exact versioned endpoint list includes
  `POST /v1/test_helpers/shared_payment/granted_tokens`.
- Stripe describes the create endpoint as creating a test
  `SharedPaymentGrantedToken` and as available only in test mode.
- The exact `2026-08-26.dahlia` request requires:
  - `payment_method` — required string.
  - `usage_limits` — required object.
  - `usage_limits.currency` and `usage_limits.max_amount` are required; an expiry
    may also be supplied.
- The documented response includes a test-mode indicator and a generated granted
  token. No response or token value was obtained in this preflight.
- Stripe documents an optional test-helper revoke endpoint for a created granted
  token, but no cleanup request is authorized unless its exact use is approved and
  remains inside the active window.

## Documentation/scope conflict

The approved one-helper request cannot yet be constructed from approved inputs:

- The official helper requires an exact `payment_method`.
- No exact non-secret test PaymentMethod reference is supplied or approved.
- No creation request for a PaymentMethod is authorized.
- The packet expressly prohibits PaymentMethod substitution and says not to reuse
  an existing test object as substituted capability evidence.
- The helper also requires exact usage limits. Currency and a maximum amount need
  explicit approved values even though payment execution remains zero.

Supplying, guessing, searching for, or creating a PaymentMethod would broaden the
approved scope. The helper/version combination therefore exists in official docs,
but the exact approved request is incomplete.

## Fail-closed blockers

1. Exact non-secret Stripe account/profile identifier is missing.
2. Exact owner-approved start/end timestamps are missing; only a maximum duration
   is approved.
3. Exact approved `payment_method` input is missing.
4. Creation of a PaymentMethod is outside scope.
5. Exact helper `usage_limits.currency`, `usage_limits.max_amount`, and expiry
   policy are not approved request inputs.
6. Packet fields have not been populated for final read-back; values must not be
   inferred from historical dashboard observations.

Any one blocker is sufficient to stop. No vault or credential tool may be called.

## Final execution checklist

All items must be `PASS` in one fresh read-back immediately before credential
retrieval. Current status is shown here.

| Check | Required evidence | Preflight status |
| --- | --- | --- |
| Exact preparation candidate | Full commit and clean worktree | PASS at `6eefb4524e7cbfe323b83e570195e43c6cfdd17a` before this evidence artifact |
| ADR state | ADR-0003 says proposed/blocked | PASS |
| Payment surface | Handlers empty; complete/delegate-payment hard-blocked | PASS from accepted local candidate evidence; must re-read before execution |
| Product scope | Bounded question and replay-only fallback approved | REPORTED APPROVED via Hermes; exact approval record must be attached without secrets |
| Account-owner scope | One helper request, zero payment/USD0, operator/reviewer, stop conditions | REPORTED APPROVED via Hermes |
| Rotation/custody | Owner attests rotation and approved custody; no value exposed | REPORTED ATTESTED via Hermes; must remain non-secret |
| Account/profile identity | Exact current non-secret identifier matches approved target | BLOCKED — missing |
| Test mode | Fresh non-secret read-back proves exact target is test mode | BLOCKED until exact identifier/read-back; no credential use permitted for preflight |
| Stripe API pin | Request header exactly `2026-08-26.dahlia` | DOCUMENTED; execution still blocked |
| ACP pin | Repository artifact exactly `2026-04-17` | PASS from accepted repository evidence |
| Helper endpoint | Official exact-version docs list create test helper | PASS |
| Helper prerequisites | Exact approved PaymentMethod and usage limits | BLOCKED — missing/out of scope |
| Provider request count | One helper call, no retry | APPROVED BOUNDARY; not executed |
| Cleanup | Optional one exact documented revoke only if pre-approved and needed | CONDITIONAL; no created object exists |
| Payment boundary | Zero PaymentIntent/confirmation/capture, count 0, USD0 | PASS AS PROHIBITION; not executed |
| Active window | Exact owner-approved start/end, at most 30 minutes | BLOCKED — missing |
| Immediate approval | User confirms immediately after full final read-back | NOT REQUESTED because earlier blockers prevent reaching boundary |
| Credential retrieval | Vault injection only after every prior check passes | NOT PERMITTED |

## Required unblock evidence

Before another preflight, provide through a non-secret approval channel:

1. Exact non-secret Stripe account/profile identifier and owner/profile label.
2. Exact start and end timestamps, no more than 30 minutes apart.
3. Product/account-owner decision for the required `payment_method` input:
   - approve one exact pre-existing test PaymentMethod reference for this helper,
     while reconciling the packet's no-substitution rule; or
   - approve a separately bounded prerequisite package to create one; or
   - decline and retain replay-only behavior.
4. Exact approved helper usage limits: currency, maximum amount, and expiry policy.
5. Updated packet read-back showing those values and confirming no scope expansion.
6. A new immediate approval after Emily presents the complete final checklist.

Until then, retain replay-only behavior, empty payment handlers, hard-blocked
complete/delegate-payment, and ADR-0003 proposed/blocked.
