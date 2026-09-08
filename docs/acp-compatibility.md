# ACP compatibility record

Status: pending Phase 0 verification.

This record must describe what the implementation actually supports. It is not a
claim that all ACP checkout or delegated-payment capabilities are available.

## Pinned artifact

| Field | Verified value | Evidence |
| --- | --- | --- |
| Released revision/version | Pending | — |
| Schema commit/hash | Pending | — |
| Changelog/release URL | Pending | — |
| License and retained notices | Pending | — |
| Required version headers | Pending | — |
| Authentication mechanism | Pending | — |

The PRD names the documented 2026-01-30 revision as a candidate baseline only.
Do not copy it here as verified without checking the upstream release and exact
artifacts.

## Operation support

| Operation | Pinned endpoint/schema | Implementation status | Contract-test evidence | Known omissions |
| --- | --- | --- | --- | --- |
| Create checkout | Pending | not started | — | — |
| Retrieve checkout | Pending | not started | — | — |
| Update checkout | Pending | not started | — | — |
| Complete checkout | Pending | not started | — | — |
| Cancel checkout | Pending | not started | — | — |
| Capability negotiation | Pending | not started | — | — |

## Payment-handler and credential path

Record the actual supported test credential flow, authentication, handler schema,
Stripe API version, test-account capability, and safe backend resolution path.
Never paste credentials, client secrets, reusable tokens, PAN/CVV, or complete
provider payloads.

Decision outcomes:

1. Supported delegated-token path — document scope and validation.
2. Pinned-ACP-supported custom handler — document the exact extension and label.
3. No compatible handler — keep validated ACP checkout operations and identify
   Stripe completion as a separate application extension. The product label must
   say “ACP checkout subset + custom Stripe sandbox completion”.
4. No safe supported completion path — mark Live Sandbox blocked and ship replay
   only until the dependency changes.

## Compatibility test matrix

| Test | Expected | Status | Evidence |
| --- | --- | --- | --- |
| Requests validate against pinned schemas | All supported requests pass | planned | — |
| Responses validate against pinned schemas | All supported responses pass | planned | — |
| Version mismatch | Explicit safe error; no mixed fields | planned | — |
| Missing/invalid server auth | Denied without checkout leakage | planned | — |
| Cross-run checkout access | Denied | planned | — |
| Mutation retry | Stable application idempotency behavior | planned | — |
| Advertised capabilities | Exactly match implemented handlers/operations | planned | — |
| Minimal test payment | One supported Stripe test sale and verified callback | planned | — |

## Approved compatibility statement

Pending. Write the shortest accurate public statement only after the tests above
and ADR-0002/0003 are accepted.
