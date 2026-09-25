# M3 Stripe owner-approval setup package

Status: ACTION REQUIRED FROM PRADS; no trust anchor or execution approval has been established.

Candidate context: QA-SPIKE-01 FAIL on `bd5cfe79ed11ee3de1d7544afd3085513b5eb8d9`. This local remediation disables the execution entry point and removes the provider transport implementation. This document requests design/security setup decisions only. It is not an approval to generate/provision keys, retrieve credentials, contact Stripe, or execute a request.

## Current hard boundary

Until all required trust anchors and replay controls below are approved, `executeApprovedStripeCapabilitySpike` always rejects before inspecting input, state creation, credential callback, or provider callback. The transport contains no network implementation. Approval packet values and a caller-provided function are not authorization evidence. The previous candidate remains non-executable; its time window does not authorize a request.

## Owner actions required before code can be re-enabled

Prads is the authoritative account/resource owner and immediate execution approver. Please provide an explicit decision for each item; an unanswered item keeps the guard disabled.

1. Approval signer and trust-root lifecycle
   - Select an existing approved owner-signing mechanism, or explicitly authorize a security-reviewed setup ceremony. No key may be generated or provisioned by engineering before that approval.
   - Identify who controls the private signing key, its custody boundary, authorized signers, key identifier, revocation authority, rotation/recovery procedure, and audit evidence.
   - Specify how the verifier obtains an independently trusted public-key pin/allowlist. Do not trust a key or fingerprint supplied alongside the signed receipt or mutable only in the candidate repository.
   - Proposed interoperable encoding for review: Ed25519 signature over RFC 8785 canonical JSON, with an explicitly pinned key ID and strict algorithm/version allowlist. This is a proposal, not an established implementation choice.

2. Authenticated operator identity
   - Select an independently authenticated source that yields a stable operator subject and proof verifiable by the guard.
   - Bind the receipt to that subject and require proof-of-possession or an authenticated assertion at use time. Do not treat caller-supplied identity strings, usernames, UID, environment variables, or callbacks as proof.
   - Name the identity authority, its verification trust root, expiry/revocation semantics, and who may approve the operator.

3. Protected durable nonce-consumption store
   - Approve the exact state service/location and owner/security controls. It must support atomic create-if-absent keyed by unpredictable nonce, durable commit before credential access, concurrent single-winner semantics, access control, audit, and fail-closed behavior on storage errors.
   - Define backup/restore and rollback protection so recovery cannot make a consumed nonce unused again. A caller-selectable file path or ordinary resettable local file is not sufficient without a reviewed tamper/rollback model.
   - Identify the store owner and authorized recovery procedure. Engineering must not create a hosted resource or change credentials/security configuration under this package.

## Signed one-time receipt contract to implement after approval

The owner-signed receipt must bind, without caller override:

- exact guard candidate commit and frozen request hash plus canonical request literals;
- account and sandbox profile;
- Stripe API and ACP versions;
- authorized owner identity and signer key ID;
- authenticated executing operator identity;
- exact outer window start/end epochs;
- issued-at and expiry, with action lease no longer than 600 seconds and capped at outer end;
- exact one-request scope, zero-payment/USD 0 scope, and no retry/redirect/fallback/resubmit;
- explicit cleanup/revoke disposition and its limits;
- owner approval time and an unpredictable unique nonce.

Verification order: authenticate operator and verify receipt signature/bindings/fresh clock before any credential callback; atomically consume the nonce and durably commit before requesting credentials; then re-verify the same signature, operator, commit/request identity, NTP freshness, outer window, and unchanged lease immediately before dispatch. If any step is absent, malformed, stale, ambiguous, revoked, replayed, or storage state cannot be proven, reject with zero credential/provider callbacks. Concurrent use has one nonce-consumption winner; all losing/replayed requests have zero callbacks. Once consumed, errors do not permit retry.

## Required regression evidence

Use ephemeral test-only keys and isolated fake durable-store implementations; never use real owner keys, credentials, or provider transport. Add tests for missing receipt, forged signature, malformed encoding, stale/expired receipt, nonce replay, concurrent consume race, wrong owner/key ID, wrong operator/proof, wrong commit, request hash/literals, account/profile, API/ACP version, outer-window endpoints, lease over 600 seconds or beyond outer end, altered payment/request/cleanup scope, revoked key/operator, and nonce-store errors/rollback ambiguity. Every rejected case must assert credential and provider callback counts are both zero. Include a positive verifier-only test showing a valid synthetic receipt binds to the exact candidate and can be consumed once; it must not dispatch to a provider.

## Approval record to return

Prads must identify the selected signer/trust-root process, operator identity source, and protected nonce store, plus their accountable owners and rotation/revocation/recovery procedures. Security must approve the lifecycle and storage threat model. Product must confirm the exact receipt scope and owner-approval ceremony. Only then may Emily implement a verifier-only package on a new isolated branch and submit a new exact candidate to Tab. Re-enabling any credential/provider boundary requires a separate explicit approval after independent QA; no approval is granted here.
