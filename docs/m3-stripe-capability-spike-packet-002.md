# M3 Stripe sandbox capability-spike approval packet — NEW WINDOW

**Status:** preflight inputs frozen; immediate credential-boundary approval pending. Do not execute.

## Execution window

The September 24 21:00 CDT through September 24 23:00 CDT two-hour window below supersedes the expired September 23 22:35 CDT window.

**Approved start:** `2026-09-24T21:00:00-05:00` (CDT)
**Approved end:** `2026-09-24T23:00:00-05:00` (CDT)
**Window epochs:** `1790240400` through `1790247600`
**Verified duration:** `7200` seconds (2 hours)

The NTP-corroborated host epoch is the sole execution-time authority. The local
guard requires one unambiguous successful selected sample from
`time.apple.com` via `sntp -d time.apple.com`, numeric absolute offset no greater
than 1 second, and evidence no older than 60 seconds. Session, chat, document, and
approval-receipt date metadata are non-authoritative. Missing, duplicate, malformed,
failed, stale, future, wrong-target, disagreeing, or excessive-offset evidence
stops before credential access. No date may be inferred, normalized, silently
substituted, or implemented by changing system time.

## Package identity

- Package ID: `M3-STRIPE-CAP-SPIKE-002`
- Preparation base commit (pre-existing spike-prep repo): `bd5cfe7`
- Governing Product contract: `M3.1-readiness`
- Related artifacts:
  - `docs/decisions/0003-stripe-payment-path.md` — remains proposed/blocked
  - `docs/m3-entry-exit-gate-matrix.md` — E03-E08 blocked/partial; E09 local-only
  - `docs/m3-external-evidence-template.md` — redacted evidence schema
  - `docs/acp-compatibility.md` — ACP payment handlers empty
  - `docs/m3-stripe-spike-guard.md` — fail-closed execution guard
  - `docs/m3-unblocked-summary-2026-09-24.md` — unblocked-gates summary

## Bounded Product question for Pete

In the owner-approved dedicated Stripe sandbox, with the Stripe API request pinned
to `2026-08-26.dahlia` and PaymentLab's ACP contract pinned to `2026-04-17`, does
the documented Stripe test helper permit **one** capability-only creation of a
simulated granted Shared Payment Token suitable for evaluating the ACP
delegate-payment path, **without** creating or confirming a PaymentIntent, charging
any amount, registering a webhook destination, or deploying anything?

Acceptable evidence outcomes are exactly:

1. **SUPPORTED** — the approved helper returns the documented test-mode SPT result
   and the redacted response shape is sufficient for a later ADR review.
2. **UNSUPPORTED** — the account/API returns a documented entitlement or unsupported
   result.
3. **AMBIGUOUS** — the result cannot establish capability without broadening scope,
   changing versions, creating a payment, or making another provider mutation.

No outcome accepts ADR-0003 automatically. Pete must review the redacted result and
choose the next Product disposition.

## Replay-only fallback requested from Pete

If the result is UNSUPPORTED, AMBIGUOUS, or no approved spike runs, retain the
replay-only product path:
- Advertise `capabilities.payment.handlers: []`
- Keep complete checkout and delegate payment hard-blocked
- Make no provider-payment, hosted, deployed, or compatibility claim
- Keep ADR-0003 proposed/blocked
- Preserve the QA-passed local synthetic baseline and truthful ACP subset label
- Require a new Product/account-owner approval packet for any alternative path

**Pete approval read-back:**
- Bounded question approved: `YES — written approval reported by Hermes`
- Replay-only fallback approved: `YES — written approval reported by Hermes`
- Accepted result classes: `SUPPORTED / UNSUPPORTED / AMBIGUOUS`
- Product approver: `Pete`
- Approval receipt recorded: `TBD (immediate)`
- Conditions: exact scope and stop conditions in this packet

## Requested sandbox/account/profile

**Target:** the historically observed dedicated `PradPay sandbox` in test mode.

| Field | Value |
|---|---|
| Stripe account/sandbox label | `PradPay sandbox` |
| Non-secret account identifier/reference | `acct_1UDULUFDhOfb5F0F` |
| Approved test PaymentMethod reference | `pm_1UIbCpFDhOfb5F0FVPrBIB0T` |
| Profile/account owner | `Prads` |
| Mode | `test` only |
| Mode re-check before auth | `YES` |
| Existing test object substitution | `NONE` |

A mismatch in label, account, profile, owner, or mode is a **stop condition**.

## Version pins

- Stripe API version: `2026-08-26.dahlia` (pinned, not changed)
- ACP artifact version: `2026-04-17` (pinned)
- No opportunistic version fallback, preview upgrade, or account-default mutation

## Capability-only scope (exactly 1 provider request)

1. One authenticated request to the documented Stripe test helper (simulate granted SPT)
2. Local, non-network validation of redacted response shape against ACP 2026-04-17 delegate-payment requirements
3. Recording result class: `SUPPORTED` / `UNSUPPORTED` / `AMBIGUOUS`
4. One provider-documented cleanup request **only if** the helper creates a cleanable test artifact (optional, pre-approved)

**Maximum provider request count:** one capability-helper request.
**Payment count:** zero. **Approved payment amount:** USD 0.00.

## Exact helper inputs (frozen)

| Field | Value |
|---|---|
| `payment_method` | `pm_1UIbCpFDhOfb5F0FVPrBIB0T` |
| `usage_limits.currency` | `usd` |
| `usage_limits.max_amount` | `100` (minor units) |
| `usage_limits.expires_at` | `1790247600` |
| | (`2026-09-24T23:00:00-05:00`, CDT) |

The complete approved request including account/profile, endpoint, versions,
capability, zero-payment effects, and no-retry/no-redirect/no-fallback/no-resubmit
transport policy is frozen under SHA-256:

```
9b65d45d89ce5ad18eb6f1da316b89cbaba2ae4ea14566dfc5a6b863022b0f9f
```

Any hash or literal mismatch stops before credential access.

## Operators and supervision

| Role | Person | Responsibility |
|---|---|---|
| Execution operator | Riley | Calls the helper |
| Integration reviewer / stop authority | Emily | Verifies credential boundary, returns evidence |
| Product decision owner | Pete | Accepts/records the result |
| Account/credential owner / immediate approver | Prads | Approves scope, rotates secret, approves at credential boundary |
| QA reviewer (after redacted evidence) | Tab | Validates the exact deployed build later |

## Execution-time requirements (checked at credential boundary)

1. Pete's bounded-question and replay-only approvals complete
2. Prads approved exact account/profile, versions, scope, operator, window, cleanup, zero-payment limit, stop conditions
3. Secret rotation/custody attestation complete and current
4. NTP parser passes: `sntp -d time.apple.com`, selected sample, offset `<= 1s`, age `0..60s`
5. Outer window active (`1790240400` inclusive, `1790247600` exclusive)
6. Action lease active (immutable, max 600s, anchored to immediate-approval epoch, capped by outer end)
7. Frozen request hash matches
8. Atomic one-shot claim not yet consumed
9. ADR-0003 still proposed/blocked, payment handlers still empty

**If any item fails: do NOT call the vault, do NOT retrieve/inject a credential, do NOT call Stripe.**

## Stop conditions

- Stop **before** credential access if: Pete/Prads approvals incomplete, rotation unconfirmed, account/mode mismatch, window not active, NTP fails, hash mismatch, lease expired, ADR-0003 no longer proposed/blocked.
- Stop **after** credential access if: live-mode indicator, wrong account, helper creates a PaymentIntent, response requests broader permission/destination/deployment, request fails/times out/rate-limited, result includes sensitive data, credential appeared in output/logs/screenshot.

**After first helper result: make no retry or further capability call.** Only the pre-approved cleanup request may follow.

## Secret rotation and custody attestation

| Field | Value |
|---|---|
| Previously exposed test secret rotated | `TBD — owner attests via Hermes` |
| Rotation performed by | `Prads` |
| Replacement stored in approved secret store | `TBD` |
| Access limited to requested operator/window | `TBD` |
| Secret value in this packet | `NO` |

## Approval checklist (Prads signs all together)

| Item | Sign |
|---|---|
| Exact sandbox/account: `acct_1UDULUFDhOfb5F0F` / `PradPay sandbox` | `TBD` |
| Exact PaymentMethod: `pm_1UIbCpFDhOfb5F0FVPrBIB0T` | `TBD` |
| Stripe API pin `2026-08-26.dahlia` | `TBD` |
| ACP pin `2026-04-17` | `TBD` |
| One capability-helper request | `TBD` |
| Usage limits: `usd`, `100`, expiry `1790247600` | `TBD` |
| Cleanup request (if needed) | `TBD` |
| Payment count 0, amount USD 0.00 | `TBD` |
| Operator Riley, reviewer Emily | `TBD` |
| Window `2026-09-24T21:00` through `2026-09-24T23:00` | `TBD` |
| NTP clock authority | `TBD` |
| Frozen request hash | `TBD` |
| Action lease | `TBD` |
| No delayed/retry/repeated | `TBD` |
| Stop conditions acknowledged | `TBD` |
| Written approval receipt | `TBD` |
| **Immediate approval timestamp** | `PENDING — DO NOT REQUEST UNTIL FINAL READ-BACK` |

## Redacted evidence fields (post-execution)

Only these fields may appear in the post-execution record:
- Package ID, source commit
- Approval identities/timestamps
- Sandbox label, redacted account ref, test-mode assertion
- Stripe API/ACP versions
- Operator, actual request count, result class
- Provider request ID (redacted), HTTP/result classification (no headers/body)
- Cleanup status/reference
- Zero-payment/zero-destination/zero-deployment confirmation
- Reviewer disposition and next blocked/approved package

**Never retain:** authorization headers, API keys, SPT/token values, client secrets, webhook secrets, complete bodies, dashboard screenshots with credentials, customer data, payment instrument data.

