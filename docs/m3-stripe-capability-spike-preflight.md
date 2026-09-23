# M3 Stripe capability-spike final non-secret preflight

Status: `COMPLETE — PAUSED BEFORE CREDENTIAL BOUNDARY`

This September 23 final read-back supersedes every September 22 execution-window
draft. September 22 approval-receipt timestamps remain historical metadata only.

Final read-back prepared: `2026-09-22T16:29:20-05:00`

Preflight input commit: `44ee2724faefdd8ab600d5bfe639a5444923c76f`

Approval packet: `docs/m3-stripe-capability-spike-approval-packet.md`

No credential was requested, retrieved, injected, displayed, or used. No Stripe API
request, PaymentMethod creation/search/substitution, webhook destination,
deployment, hosted-resource mutation, payment, push, PR, merge, or production
action occurred.

## Written authority read-back

Hermes reported the user's written approval and secret-rotation/custody attestation
for exactly this scope:

- Stripe account: `acct_1UDULUFDhOfb5F0F`
- Sandbox label: `PradPay sandbox`
- Pre-existing test PaymentMethod: `pm_1UIbCpFDhOfb5F0FVPrBIB0T`
- Stripe API: `2026-08-26.dahlia`
- ACP: `2026-04-17`
- Provider action: one SharedPaymentGrantedToken test-helper request
- Usage currency: `usd`
- Usage maximum: `100` minor units
- Usage expiry: `2026-09-23T21:10:00-05:00` (CDT)
- Exact expiry timestamp: `1790215800`
- Execution window: `2026-09-23T20:50:00-05:00` through
  `2026-09-23T21:10:00-05:00` (CDT)
- Window epochs: `1790214600` through `1790215800`
- Verified duration: `1200` seconds (20 minutes)
- Operator: Riley (`@integrations-reliability-engineer`)
- Reviewer/stop authority: Emily (`@emily`)
- Payment count: `0`
- Payment amount: `USD 0.00`
- Retry count: `0`
- Cleanup: only the official revoke of the created test granted token, if needed,
  pre-approved, and completed before the window closes
- All packet stop conditions remain binding
- No webhook destination, deployment, hosted resource, payment, push, PR, merge,
  production action, account-setting mutation, or API-version change

All identifiers and values above are preserved literally from the supplied scope.
No identifier was normalized, inferred, searched, or replaced.

## Packet and repository verification

- Branch: `docs/m3-stripe-capability-spike-prep`
- Approval packet base: `6eefb4524e7cbfe323b83e570195e43c6cfdd17a`
- First blocked-preflight evidence: `44ee2724faefdd8ab600d5bfe639a5444923c76f`
- ADR-0003 remains proposed/blocked.
- Payment handlers remain empty in the accepted local candidate.
- Complete checkout and delegate payment remain hard-blocked.
- The packet now contains the exact account, PaymentMethod, versions, helper
  inputs, execution window, operator/reviewer, zero-payment boundary, rotation and
  custody attestation, cleanup boundary, and stop conditions.
- Immediate execution approval remains deliberately pending.

## Official helper schema verification

Primary official source:

`https://docs.stripe.com/api/shared-payment/granted-token/create.md?api-version=2026-08-26.dahlia`

Official cleanup source:

`https://docs.stripe.com/api/shared-payment/granted-token/revoke.md?api-version=2026-08-26.dahlia`

Verified for `2026-08-26.dahlia`:

- Create endpoint:
  `POST /v1/test_helpers/shared_payment/granted_tokens`
- Stripe describes the endpoint as test-mode-only.
- Required request fields:
  - `payment_method` string
  - `usage_limits` object
  - `usage_limits.currency`
  - `usage_limits.max_amount`
- `usage_limits.expires_at` is accepted as a timestamp.
- The official cleanup endpoint is:
  `POST /v1/test_helpers/shared_payment/granted_tokens/{id}/revoke`
- No PaymentIntent is required by the helper request itself.
- No provider request was executed to obtain this documentary evidence.

Approved request-field mapping:

| Official field | Approved literal value | Status |
| --- | --- | --- |
| `payment_method` | `pm_1UIbCpFDhOfb5F0FVPrBIB0T` | COMPLETE |
| `usage_limits.currency` | `usd` | COMPLETE |
| `usage_limits.max_amount` | `100` | COMPLETE |
| `usage_limits.expires_at` | `1790215800` | COMPLETE |
| Stripe request version | `2026-08-26.dahlia` | COMPLETE |

The corrected expiry conversion was independently computed from
`2026-09-23T21:10:00-05:00` and equals `1790215800`.

## Exact final read-back checklist

| Check | Exact evidence | Status |
| --- | --- | --- |
| Account/profile | `acct_1UDULUFDhOfb5F0F` / `PradPay sandbox` | PASS — owner supplied |
| Test mode | Owner identifies exact account as dedicated test account | PASS subject to mandatory runtime `livemode:false`/test-mode check; mismatch stops |
| PaymentMethod | `pm_1UIbCpFDhOfb5F0FVPrBIB0T` | PASS — one pre-existing test reference supplied; do not search/create/substitute |
| Stripe API | `2026-08-26.dahlia` | PASS |
| ACP | `2026-04-17` | PASS |
| Helper endpoint | Official exact-version create test-helper endpoint | PASS |
| Helper schema | PaymentMethod and usage limits match required fields | PASS |
| Currency | `usd` | PASS |
| Maximum amount | `100` minor units | PASS |
| Expiry | `1790215800` / `2026-09-23T21:10:00-05:00` | PASS |
| Provider request count | One create-helper request | PASS AS APPROVED BOUNDARY; not executed |
| Retry | None | PASS AS APPROVED BOUNDARY |
| Payment | Count `0`; `USD 0.00`; no PaymentIntent/confirmation/capture | PASS AS PROHIBITION |
| Cleanup | At most one official revoke of the created token, if needed before window end | PASS AS CONDITIONAL BOUNDARY |
| Window | `2026-09-23T20:50:00-05:00` (`1790214600`) to `2026-09-23T21:10:00-05:00` (`1790215800`); `1200` seconds | PASS; execution prohibited outside window |
| Operator | Riley | PASS |
| Reviewer/stop authority | Emily | PASS |
| Product scope/fallback | Written approval reported via Hermes | PASS |
| Account-owner scope | Written approval reported via Hermes | PASS |
| Rotation/custody | Owner attested rotated secret and approved custody; no value inspected | PASS AS OWNER ATTESTATION |
| ADR state | Proposed/blocked | PASS |
| Payment handlers | Empty; complete/delegate-payment hard-blocked | PASS from accepted candidate; re-read immediately before credential retrieval |
| Immediate approval | Must be supplied after this final read-back and during the active window | PENDING — NOT REQUESTED IN THIS PACKAGE |
| Credential retrieval | Vault injection only after immediate approval and fresh runtime checks | PAUSED / NOT PERMITTED YET |

## Mandatory immediate boundary checks

After the window opens and before any vault or credential action, Emily must freshly
read back all of the following:

1. Current time is on or after `2026-09-23T20:50:00-05:00` and before
   `2026-09-23T21:10:00-05:00`.
2. Immediate user approval explicitly names this exact final read-back and still
   authorizes credential retrieval plus one helper request.
3. The exact target remains `acct_1UDULUFDhOfb5F0F` / `PradPay sandbox`.
4. The injected credential resolves to test mode for that exact account; any
   mismatch or live-mode indicator stops before the helper request.
5. Request version remains `2026-08-26.dahlia`.
6. Request inputs remain exactly:
   - `pm_1UIbCpFDhOfb5F0FVPrBIB0T`
   - `usd`
   - `100`
   - `1790215800`
7. ADR-0003 remains proposed/blocked; payment handlers remain empty; complete and
   delegate payment remain hard-blocked.
8. No payment, destination, deployment, hosted mutation, second request, retry, or
   broader scope has been added.

If any check fails, do not retrieve/inject a credential and do not call Stripe.

## Stop conditions after immediate approval

Stop without retry if:

- The current time is outside the approved window.
- Account/profile or test-mode identity differs.
- Any literal request input differs.
- Stripe requires a different PaymentMethod, version, field, permission, account
  setting, destination, deployment, hosted resource, or payment action.
- Authentication fails, times out, is rate-limited, or is ambiguous.
- The response is live-mode, unexpected, unsafe to redact, or exposes sensitive
  data.
- A credential appears in output, logs, screenshots, chat, docs, or model context.
- The one helper request returns any result. No retry or further capability call is
  allowed; only the pre-approved official revoke may follow if needed before the
  window closes.

## Credential boundary

The package is paused immediately before credential retrieval. Credentials become
required only when, during the approved window and after immediate user approval,
Riley is about to authenticate the single helper request. No vault action or Stripe
call is authorized by this preflight alone.
