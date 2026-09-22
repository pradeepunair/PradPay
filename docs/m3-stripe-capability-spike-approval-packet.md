# M3 Stripe sandbox capability-spike approval packet

Status: non-secret preflight inputs complete; immediate credential-boundary approval pending. Do not execute.

Package ID: `M3-STRIPE-CAP-SPIKE-001-PREP`

Preparation base: `24e10587985f88d37c99f339b9a2935575c01091`

Governing Product contract: `M3.1-readiness`

Related artifacts:

- `docs/decisions/0003-stripe-payment-path.md` — remains proposed/blocked.
- `docs/m3-entry-exit-gate-matrix.md` — E03-E08 blocked/partial; E09 local-only; X-gates externally unaccepted.
- `docs/m3-external-evidence-template.md` — redacted evidence schema.
- `docs/acp-compatibility.md` — ACP payment handlers empty; complete/delegate-payment hard-blocked.

## Preparation boundary

This document prepares an approval request only. It does not authorize or perform
credential access, Stripe/provider calls, webhook destination creation, deployment,
hosted-resource mutation, payment, uncertain-response injection, push, PR, or merge.
No ordinary CI command may execute the proposed provider action.

## Bounded Product question for Pete

In the owner-approved dedicated Stripe sandbox, with the Stripe API request pinned
to `2026-08-26.dahlia` and PaymentLab's ACP contract pinned to `2026-04-17`, does
the documented Stripe test helper permit one capability-only creation of a
simulated granted Shared Payment Token suitable for evaluating the ACP
delegate-payment path, without creating or confirming a PaymentIntent, charging
any amount, registering a webhook destination, or deploying anything?

Acceptable evidence outcomes are exactly:

1. `SUPPORTED`: the approved helper returns the documented test-mode SPT result
   and the redacted response shape is sufficient for a later ADR review.
2. `UNSUPPORTED`: the account/API returns a documented entitlement or unsupported
   result.
3. `AMBIGUOUS`: the result cannot establish capability without broadening scope,
   changing versions, creating a payment, or making another provider mutation.

No outcome accepts ADR-0003 automatically. Pete must review the redacted result and
choose the next Product disposition.

## Replay-only fallback requested from Pete

If the result is `UNSUPPORTED`, `AMBIGUOUS`, or no approved spike runs, retain the
replay-only product path:

- Advertise `capabilities.payment.handlers: []`.
- Keep complete checkout and delegate payment hard-blocked.
- Make no provider-payment, hosted, deployed, or compatibility claim.
- Keep ADR-0003 proposed/blocked.
- Preserve the QA-passed local synthetic baseline and truthful ACP subset label.
- Require a new Product/account-owner approval packet for any alternative custom
  completion path or later provider test.

Pete approval read-back:

- Bounded question approved: `YES — written approval reported by Hermes`
- Replay-only fallback approved: `YES — written approval reported by Hermes`
- Accepted result classes: `SUPPORTED / UNSUPPORTED / AMBIGUOUS`
- Product approver: `Pete`
- Approval receipt recorded: `2026-09-22T16:29:20-05:00`
- Conditions: exact scope and stop conditions in this packet; immediate approval
  remains separately required at the credential boundary.

Until every required `YES` and timestamp is present, stop before credential access.

## Requested sandbox/account/profile

The requested target is the historically observed dedicated `PradPay sandbox` in
test mode. Historical observation is not current evidence. Before execution, the
account owner must freshly confirm all non-secret identity fields below without
exposing any credential value:

- Stripe account/sandbox label: `PradPay sandbox`
- Non-secret account identifier/reference: `acct_1UDULUFDhOfb5F0F`
- Approved test PaymentMethod reference: `pm_1UIbCpFDhOfb5F0FVPrBIB0T`
- Profile/account owner: `Prads`
- Mode: `test` only
- Owner-supplied identity recorded at: `2026-09-22T16:29:20-05:00`
- No live-mode context selected: `YES — owner identified this as the dedicated test account; recheck immediately before authentication`
- Existing test object substitution: `NONE`; the literal PaymentMethod above is the
  one explicitly supplied and approved for this helper request.

A mismatch in label, account, profile, owner, or mode is a stop condition, not a
reason to search another account.

## Version pins

- Requested Stripe API version: `2026-08-26.dahlia`.
- Evidence basis: historical Phase 0 observation only; the operator must verify
  that the approved helper documentation supports this exact request version
  before credential access. Do not change the account default.
- Pinned ACP artifact version: `2026-04-17`.
- ACP source integrity remains the repository's vendored manifest/hashes.
- No opportunistic version fallback, preview upgrade, or account-default mutation
  is allowed.

If official documentation does not support the exact requested helper/version
combination, classify the preparation as blocked and return to Pete; do not call
Stripe.

## Capability-only scope

If and only if all approvals and attestations below are complete, the later
execution package may perform:

1. One authenticated request to the documented Stripe test helper in the approved
   sandbox to simulate a granted SPT.
2. Local, non-network validation of the redacted response shape against the pinned
   ACP `2026-04-17` delegate-payment decision requirements.
3. Recording one of `SUPPORTED`, `UNSUPPORTED`, or `AMBIGUOUS` using the redacted
   fields in `docs/m3-external-evidence-template.md`.
4. Provider-documented cleanup of only an artifact created by that one helper call,
   if the helper creates a cleanable test artifact and cleanup is explicitly
   included in the owner's approval.

The maximum provider request count is one capability-helper request, plus at most
one owner-approved cleanup request if provider documentation requires it. Payment
count is zero. Approved payment amount is USD 0.00. No PaymentIntent, confirmation,
capture, refund, customer, PaymentMethod substitution, webhook destination,
deployment, hosted resource, or account-setting mutation is in scope.

Exact helper inputs are fixed as follows:

- `payment_method`: `pm_1UIbCpFDhOfb5F0FVPrBIB0T`
- `usage_limits.currency`: `usd`
- `usage_limits.max_amount`: `100` minor units
- `usage_limits.expires_at`: `1790213400`
  (`2026-09-23T20:30:00-05:00`, CDT)

These values must be preserved literally. Do not search for, create, replace,
normalize, or otherwise substitute a PaymentMethod or helper input.

## Requested operator and supervision

- Requested execution operator: Riley (`@integrations-reliability-engineer`).
- Integration reviewer and stop authority: Emily (`@emily`).
- Product decision owner: Pete (`@pete`).
- Stripe account/credential/resource owner and immediate approver: Prads.
- QA reviewer after a versioned redacted evidence candidate exists: Tab (`@tab`).

The execution operator receives only approved secret-store injection at execution
time. No credential value may enter chat, task handoffs, model context, commands,
logs, screenshots, docs, fixtures, or Git.

## Requested time window

Requested maximum execution window: one owner-scheduled 30-minute window.

- Approved start: `2026-09-23T20:10:00-05:00` (CDT)
- Approved end: `2026-09-23T20:30:00-05:00` (CDT)
- Approval expires automatically at the end timestamp or, if earlier, after the
  first helper result and the one pre-approved provider-documented cleanup request.
  If cleanup is not pre-approved or not required, approval expires at the first
  helper result.
- A retry is not authorized. A new approval packet is required.

## Cleanup and rollback

Before the approved call:

- Confirm payment admission remains disabled and handlers remain empty.
- Confirm the exact sandbox/profile and test mode.
- Confirm no payment, destination, deployment, or hosted mutation is queued.

After the first helper result:

- Stop all capability/provider activity except the one pre-approved,
  provider-documented cleanup request for the helper-created test artifact.
- Record only redacted result class, safe references, timestamps, mode assertion,
  version, request count, and reviewer disposition.
- Perform at most the separately approved provider-documented cleanup request for
  the helper-created artifact; otherwise leave provider state untouched and record
  the cleanup blocker.
- Revoke any temporary execution grant and preserve replay-only behavior.
- If secret exposure is suspected, stop, notify the account owner, and rotate via
  the owner-controlled process before any further work.

## Secret rotation and custody attestation

This attestation must be completed by the account owner before any tool or operator
is allowed to retrieve or inject a Stripe credential:

- Previously exposed standard Stripe test secret rotated: `YES — owner attested via Hermes`
- Rotation timestamp: `OWNER-ATTESTED; exact secret-operation timestamp not recorded in this non-secret packet`
- Rotation performed/confirmed by: `Prads`
- Replacement stored only in approved secret store: `YES — owner attested via Hermes`
- Approved secret-store class: `owner-approved credential custody; secret location/value intentionally undisclosed`
- Access limited to requested operator/window: `YES — approved scope; enforce at immediate boundary check`
- Rotation/expiry after spike assigned to: `Prads`
- Credential value recorded in this packet: `NO — MUST REMAIN NO`

A missing, `NO`, stale, or ambiguous attestation blocks the spike.

## Account-owner approval required immediately before credential access

Prads must approve all fields together:

- Exact sandbox/account/profile: `acct_1UDULUFDhOfb5F0F` / `PradPay sandbox`
- Exact test PaymentMethod: `pm_1UIbCpFDhOfb5F0FVPrBIB0T`
- Stripe API pin `2026-08-26.dahlia`: `YES`
- ACP pin `2026-04-17`: `YES`
- One capability-helper request: `YES`
- Usage limits: `usd`, `100` minor units, expiry `1790213400`
  (`2026-09-23T20:30:00-05:00` CDT)
- Optional single cleanup request: `YES, only the documented revoke of the object
  created by the one helper request, if needed before window end`
- Payment count `0` and amount `USD 0.00`: `YES`
- Operator Riley and reviewer Emily: `YES`
- Exact start/end window: `2026-09-23T20:10:00-05:00` through
  `2026-09-23T20:30:00-05:00` (CDT)
- Stop conditions and replay-only fallback acknowledged: `YES`
- Written approval receipt recorded: `2026-09-22T16:29:20-05:00`
- Immediate approval timestamp: `PENDING — DO NOT REQUEST UNTIL FINAL READ-BACK IS RETURNED`

Approval to prepare this packet is not approval to access credentials or execute
the spike.

## Exact credential boundary

Credentials become required at the instant the approved execution operator is
about to authenticate the single test-helper request. All documentation review,
version confirmation from public official documentation, local schema inspection,
approval collection, and non-secret environment identity confirmation occur before
that point and require no Stripe secret.

Immediately before credential retrieval/injection, Emily must verify:

1. Pete's bounded-question and replay-only approvals are complete.
2. Prads approved the exact account/profile, versions, one-request scope, operator,
   time window, cleanup, zero-payment limit, and stop conditions.
3. Rotation/custody attestation is complete and current.
4. The approved start time has arrived and the end time has not passed.
5. ADR-0003 still says proposed/blocked and payment handlers are still empty.

If any item fails, do not call the vault, do not retrieve/inject a credential, and
do not call Stripe.

## Redacted evidence fields

The later execution record may contain only:

- Package ID and exact source commit
- Product and account-owner approval identities/timestamps
- Non-secret sandbox label and redacted account reference
- Test-mode assertion
- Stripe API and ACP versions
- Operator, start/end, and actual provider request count
- Result class: `SUPPORTED`, `UNSUPPORTED`, or `AMBIGUOUS`
- Provider request ID or object reference only in redacted form
- HTTP/result classification without complete headers or body
- Cleanup status/reference
- Confirmation of zero payments, zero amount, zero destinations, zero deployment,
  and zero hosted-resource mutations
- Reviewer disposition and next blocked/approved package

Never retain authorization headers, API keys, SPT/token values, client secrets,
webhook secrets, complete request/response bodies, dashboard screenshots containing
credentials, customer data, or payment instrument data.

## Explicit stop conditions

Stop before credential access if:

- Pete or Prads has not completed every required approval field.
- Rotation/custody is unconfirmed, stale, or ambiguous.
- The sandbox/account/profile or test-mode identity is not exact.
- The requested helper/version is not supported by current official documentation.
- The approved window has not started or has expired.
- The task would require changing an account default, version, entitlement, or
  configuration.

Stop without retry after credential access if:

- Any live-mode indicator appears.
- Authentication targets a different account/profile.
- The helper would create/confirm a payment or requires a PaymentIntent.
- The response requests broader permission, another credential, destination,
  deployment, hosted resource, or account mutation.
- The single helper request fails, times out, is rate-limited, or is ambiguous.
- The result includes unexpected sensitive data or cannot be safely redacted.
- Any credential may have appeared in output, logs, screenshots, or model context.
- The first helper result is received, regardless of result class: make no retry
  or further capability call. Only the pre-approved cleanup request may follow,
  and only before the approved window ends.

Do not retry, substitute a PaymentMethod ID, construct an `spt_` value, switch API
versions, search other accounts, or continue into a payment. Return the redacted
blocker/evidence to Emily, Pete, and the account owner.

## Approval state and next owner

- Pete/Product approval: `RECEIVED — immediate boundary approval still pending`
- Prads/account-owner bounded scope approval: `RECEIVED — immediate boundary approval still pending`
- Secret rotation/custody attestation: `RECEIVED — no value inspected`
- Authenticated capability evidence: `MISSING — NOT EXECUTED`
- ADR-0003: `PROPOSED/BLOCKED`
- Next owner: Emily returns the exact final read-back and pauses. Prads must provide
  immediate approval during the active window before any credential retrieval.
