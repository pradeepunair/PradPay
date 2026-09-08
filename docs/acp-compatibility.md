# ACP compatibility record

Status: protocol snapshot verified; payment-handler/account compatibility pending.

This record must describe what the implementation actually supports. It is not a
claim that all ACP checkout or delegated-payment capabilities are available.

## Pinned artifact

| Field | Verified value | Evidence |
| --- | --- | --- |
| Released revision/version | `2026-04-17` | Official repository marks this as latest stable; previous `2026-01-30` deprecated |
| Schema commit/hash | `7fdd78df677a94dce04c770644b0fbbb1401272b` | Exact upstream commit inspected 2026-09-08; file hashes in `protocol/acp/manifest.json` |
| Changelog/release URL | `changelog/2026-04-17.md` at pinned commit | Stable snapshot changelog |
| License and retained notices | Apache-2.0; OpenAI and Stripe notices | Pinned `LICENSE` and `NOTICE` hashes |
| Required version headers | `API-Version: 2026-04-17` | Pinned checkout/delegate-payment OpenAPI definitions |
| Authentication mechanism | Bearer authentication at the ACP server boundary | Pinned schema/RFC; PaymentLab credential issuance remains an application decision |

The PRD's `2026-01-30` value was explicitly a candidate. Upstream now marks
`2026-04-17` as the latest stable snapshot and deprecates `2026-01-30`, so
ADR-0002 selects the newer stable snapshot. ACP remains beta; the commit and
individual artifact hashes are pinned so later `main` changes cannot silently
alter PaymentLab's contract.

## Operation support

| Operation | Pinned endpoint/schema | Implementation status | Contract-test evidence | Known omissions |
| --- | --- | --- | --- | --- |
| Create checkout | `POST /checkout_sessions` | schema verified; implementation not started | Upstream validation at pinned commit | PaymentLab supports one item/quantity one only |
| Retrieve checkout | `GET /checkout_sessions/{checkout_session_id}` | schema verified; implementation not started | Upstream validation at pinned commit | — |
| Update checkout | `POST /checkout_sessions/{checkout_session_id}` | schema verified; implementation not started | Upstream validation at pinned commit | Bounded MVP updates only |
| Complete checkout | `POST /checkout_sessions/{checkout_session_id}/complete` | schema verified; payment path blocked | Upstream validation; account test pending | SPT/account support not yet verified |
| Cancel checkout | `POST /checkout_sessions/{checkout_session_id}/cancel` | schema verified; implementation not started | Upstream validation at pinned commit | Pre-completion only |
| Capability negotiation | Inline checkout capabilities plus `/.well-known/acp.json` discovery | schema verified; implementation not started | Pinned checkout schema | Advertise only implemented MVP services/handlers |

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

### Schema verification performed

On 2026-09-08, the official repository's `pnpm validate:all` completed with no
errors or warnings at the pinned commit. Each JSON Schema under
`spec/2026-04-17/json-schema/` also compiled independently with AJV draft 2020.

The repository's broad `validate:json-schema` convenience command was not used
as PaymentLab evidence because it loads all historical versions in one AJV
process. Those snapshots intentionally reuse schema IDs, causing duplicate-ID
errors; it also reports a historical 2025 schema incompatibility. PaymentLab
will compile and test only the pinned `2026-04-17` artifacts.

## Approved compatibility statement

Pending. Write the shortest accurate public statement only after the tests above
and ADR-0002/0003 are accepted.
