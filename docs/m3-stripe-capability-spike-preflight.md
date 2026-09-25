# M3 Stripe capability-spike final non-secret preflight

Status: `COMPLETE — HARD-DISABLED, PAUSED BEFORE CREDENTIAL BOUNDARY`

This September 24 21:00 CDT through September 24 23:00 CDT two-hour final read-back supersedes every earlier execution-window draft. Earlier approval-receipt timestamps remain historical metadata only.

Any future separately approved verifier must use NTP-corroborated host epoch as the
sole execution-time authority. Local parser tests require exactly one successful
selected `time.apple.com` sample, numeric absolute offset no greater than 1 second,
and evidence age 0 through 60 seconds. The hard-disabled production path performs no
such check. Session, chat, document, and approval-receipt date metadata are
non-authoritative. No date may be inferred, normalized, silently substituted, or
implemented by changing system time.

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
- Usage expiry: `2026-09-24T23:00:00-05:00` (CDT)
- Exact expiry timestamp: `1790247600`
- Execution window: `2026-09-24T21:00:00-05:00` through
  `2026-09-24T23:00:00-05:00` (CDT)
- Window epochs: `1790240400` through `1790247600`
- Verified duration: `7200` seconds (2 hours)
- No delayed execution, rollover, extension, retry, or repeated request
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
- Local guard: `docs/m3-stripe-spike-guard.md`
- Frozen approved-request SHA-256:
  `9b65d45d89ce5ad18eb6f1da316b89cbaba2ae4ea14566dfc5a6b863022b0f9f`
- Action lease: immutable, 1 through 600 seconds, capped by `1790247600`.
- Atomic one-shot claim is consumed before any credential or dispatch callback.
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
| `usage_limits.expires_at` | `1790247600` | COMPLETE |
| Stripe request version | `2026-08-26.dahlia` | COMPLETE |

The corrected expiry conversion was independently computed from
`2026-09-24T23:00:00-05:00` and equals `1790247600`.

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
| Expiry | `1790247600` / `2026-09-24T23:00:00-05:00` | PASS |
| Provider request count | One create-helper request | PASS AS APPROVED BOUNDARY; not executed |
| Retry | None | PASS AS APPROVED BOUNDARY |
| Payment | Count `0`; `USD 0.00`; no PaymentIntent/confirmation/capture | PASS AS PROHIBITION |
| Cleanup | At most one official revoke of the created token, if needed before window end | PASS AS CONDITIONAL BOUNDARY |
| Window | `2026-09-24T21:00:00-05:00` (`1790240400`) to `2026-09-24T23:00:00-05:00` (`1790247600`); `7200` seconds | PASS; execution prohibited outside window; no rollover/extension/repeat |
| Selected NTP | one success; numeric `|offset| <= 1s`; age `0..60s` | PASS IN LOCAL GUARD TESTS; runtime evidence still required |
| Action lease | immutable `<=600s`, approval-anchored, outer-end capped | PASS IN LOCAL GUARD TESTS; immediate approval pending |
| Frozen request | SHA-256 `9b65d45d89ce5ad18eb6f1da316b89cbaba2ae4ea14566dfc5a6b863022b0f9f` | PASS IN LOCAL GUARD TESTS |
| One-shot claim | atomic and consumed before callbacks | PASS IN LOCAL GUARD TESTS; runtime state not created |
| Operator | Riley | PASS |
| Reviewer/stop authority | Emily | PASS |
| Product scope/fallback | Written approval reported via Hermes | PASS |
| Account-owner scope | Written approval reported via Hermes | PASS |
| Rotation/custody | Owner attested rotated secret and approved custody; no value inspected | PASS AS OWNER ATTESTATION |
| ADR state | Proposed/blocked | PASS |
| Payment handlers | Empty; complete/delegate-payment hard-blocked | PASS from accepted candidate; re-read immediately before credential retrieval |
| Signer trust root, authenticated operator identity, protected nonce store | Not established | HARD BLOCK — see `docs/m3-stripe-owner-approval-setup.md` |
| Immediate execution approval | No verifiable one-time owner receipt mechanism | HARD-DISABLED — a new execution approval cannot activate this candidate |
| Credential retrieval | Entry point and provider transport are disabled | PROHIBITED |

## Future eligibility gates (not active)

The following are design requirements for a future separately approved and QA-verified
receipt implementation, not operational instructions. They cannot authorize credential
retrieval or provider calls on this candidate. Any missing or failed gate keeps the
entry point hard-disabled:

1. The deterministic parser accepts exactly one successful selected NTP sample
   with numeric absolute offset no greater than 1 second and age no greater than
   60 seconds. The NTP-corroborated host clock reports a time on or after
   `2026-09-24T21:00:00-05:00` and before `2026-09-24T23:00:00-05:00`.
   Record the host RFC-3339 time, Unix epoch, and NTP synchronization evidence.
   Session/chat/document timestamps are non-authoritative; any unresolved mismatch stops.
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
   - `1790247600`
7. ADR-0003 remains proposed/blocked; payment handlers remain empty; complete and
   delegate payment remain hard-blocked.
8. The approved request hash is
   `9b65d45d89ce5ad18eb6f1da316b89cbaba2ae4ea14566dfc5a6b863022b0f9f`,
   the immutable action lease is active, and the one-shot claim is unconsumed.
9. No payment, destination, deployment, hosted mutation, second request, retry, or
   broader scope has been added.

This candidate has no approved signer trust root, authenticated operator identity,
protected nonce store, receipt verifier, or network transport. Do not retrieve a
credential or perform a provider action.

## Stop conditions for any future separately authorized attempt

Stop without retry if:

- The current time is outside the approved window.
- NTP evidence is not one selected success, is stale/future, has nonnumeric or
  excessive offset, targets another source, or disagrees with its summary.
- The action lease is absent, expired, longer than 600 seconds, extended,
  re-anchored, or outside the outer window.
- The frozen request hash differs or the atomic one-shot claim is consumed.
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
