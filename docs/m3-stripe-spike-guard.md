# M3 Stripe spike local guard

Package: `M3-STRIPE-SPIKE-GUARD-001`

Status: provider-capable execution is hard-disabled. The entry point rejects every
call before inspecting input, creating state, retrieving credentials, or dispatching.
The transport module contains no network implementation. Re-enabling execution is
blocked until Product/Security-approved owner-authentication trust anchors and a
replay-resistant receipt mechanism are established and independently QA-verified.

## Boundary

This package contains no credential value and performs no provider call in tests or
ordinary CI. The production entry point now hard-fails before input inspection,
state creation, clock capture, credential retrieval, or dispatch. The provider
transport module contains no network implementation. The internal guard core and
clock helpers remain reachable only to local tests using synthetic fixtures and fake
adapters; they are not reachable from the production entry point. Local development
continues without any provider window or execution approval.

## Normative outer window

- Start, inclusive: `1790220900` (`2026-09-23T22:35:00-05:00`)
- End, exclusive: `1790228100` (`2026-09-24T00:35:00-05:00`)
- Duration: `7200` seconds

## Deterministic clock gate

The parser and host-clock adapter below are retained for future verifier-only
implementation and are exercised only with synthetic test fixtures. The hard-disabled
production entry point invokes neither one. They must not be interpreted as evidence
of live clock validation or execution authority.

`createHostClockCapture` invokes exactly `sntp -d time.apple.com` and records the
command, target, exit status, observation epoch, current host epoch, output, and
parsed sample as one immutable operation. `parseSntpSample` accepts only evidence
that contains exactly one successful `selected:` exchange and exactly one peer
summary, with that summary targeting `time.apple.com` and matching the selected
offset. It rejects missing, duplicate, ambiguous, malformed, failed, stale, future,
wrong-command, wrong-target, disagreeing, or excessive-offset evidence.

- Maximum absolute selected offset: `1.0` second, inclusive
- Maximum sample age: `60` seconds, inclusive
- Host epoch must equal the evidence check epoch
- Outer start is inclusive; outer end is exclusive

The guard never changes system time. Session, chat, and document date metadata do
not enter its execution decision.

## Disabled production boundary

`executeApprovedStripeCapabilitySpike` always rejects with the fixed disabled error
before reading caller fields. It creates no state, captures no clock, and invokes no
credential/provider callback. The transport module contains no HTTP client, fetch,
endpoint, or authorization-header implementation. No receipt verification is
implemented because Product/Security have not established an independently trusted
signer lifecycle, authenticated operator identity source, and protected durable nonce
store. Do not restore a provider-capable import or call path until those prerequisites
are explicitly approved, implemented, independently reviewed, and QA-verified.

The fixed account/request metadata and timing policy below are retained as historical
scope only; they do not authorize execution.


## Historical test-only lease constraints

The internal fake-core tests model these intended boundaries; the production entry point
never creates or validates an approval lease. Any future signed receipt must bind an
owner approval time, use an action lease from 1 to 600 seconds capped at outer end,
and require fresh independent time verification immediately before credential access
and dispatch. No lease or old scheduled window presently authorizes execution.


## Frozen request

The canonical request hash is:

`9b65d45d89ce5ad18eb6f1da316b89cbaba2ae4ea14566dfc5a6b863022b0f9f`

It covers the exact account/profile, POST path, Stripe API, ACP version, helper
capability, PaymentMethod, `usd`/`100`, expiry `1790228100`, zero-payment effects,
and transport policy. Any additional, missing, or changed field is rejected,
including alternate account/version/input/PaymentMethod/SPT capability, retry,
redirect, fallback, resubmit, or more than one attempt.

## Dormant test-only guard-core behavior

The internal guard-core module retains the lease, request, credential-metadata,
and atomic one-shot logic for local-only tests with injected fake adapters. It is
not imported by the production entry point. Tests of this internal core do not
establish owner approval or make its effects reachable from the provider boundary.
A future verifier package must not restore production reachability before trust
anchors are approved.


## Test contract

`test/m3-stripe-spike-guard.test.mjs` verifies both the dormant pure/fake guard-core
utilities and the hard-disabled production boundary. The production-specific tests
assert absent, malformed, forged, stale, replay-shaped, wrong-owner, wrong-candidate,
wrong-request/account/operator/window/scope inputs all fail before credential or
provider callbacks; hostile property getters are not evaluated. Direct transport
calls reject, and static source checks ensure the public production modules contain no
network implementation, endpoint, authorization header, or credential callback.

Other local tests exercise NTP parsing, literal request validation, lease math, and
atomic test-state behavior using fake fixtures only. Their positive fake-core tests
are not production authorization and do not enable the provider boundary.

No credential values, key generation/provisioning, signer setup, provider/vault,
webhook, deployment, hosted-resource, payment, push, PR, or merge action occurs.
