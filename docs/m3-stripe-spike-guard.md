# M3 Stripe spike local guard

Package: `M3-STRIPE-SPIKE-GUARD-001`

Status: local guard implemented; external execution remains disabled and requires a
separate exact candidate review, active-window read-back, and immediate owner
approval.

## Boundary

This package contains no credential value and performs no provider call during tests
or ordinary CI. The production entry point binds the exact Stripe helper transport,
real NTP host-clock adapter, canonical durable state path, frozen request, and
abortable deadline internally; callers may supply only the immediate approval and
approved server-side credential adapter. Local guard development and testing are
not constrained by the provider execution window; the outer and inner windows
apply only to a future explicitly approved external dispatch.

## Normative outer window

- Start, inclusive: `1790220900` (`2026-09-23T22:35:00-05:00`)
- End, exclusive: `1790228100` (`2026-09-24T00:35:00-05:00`)
- Duration: `7200` seconds

## Deterministic clock gate

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

## Fixed production composition

`executeApprovedStripeCapabilitySpike` accepts only the immediate approval and an
approved server-side credential adapter. It internally binds `createHostClockCapture`
with the host `sntp` command and `Date.now`, the frozen request, the fixed Stripe
transport, and one canonical state directory under the user's PaymentLab state
root keyed by the approved request hash. Caller-supplied clocks, request bodies,
transport functions, or alternate fence directories are rejected.

The fixed transport uses one POST, `redirect: "error"`, the pinned Stripe version,
and the action lease's `AbortSignal`. It must consume a fresh `authorizeSend`
callback immediately before `fetch`; credential retrieval and dispatch are raced
against the absolute lease deadline. An expiry abort cannot authorize a later send
or retry.

## Immutable action lease

The approval record uses only the fixed package ID `M3-STRIPE-CAP-SPIKE-001-PREP`; caller-supplied identifiers are rejected before any value can be persisted. The approval epoch must equal the first trusted host-clock epoch.
The lease duration is between 1 and 600 seconds and is capped at the outer end. A
lease cannot be extended or re-anchored, and its end is exclusive. The trusted
host clock is captured again immediately before credential retrieval and again
immediately before dispatch; either step fails closed when the lease or outer
window has expired.

Clock authority is the literal `ntp-corroborated-host-epoch`.

## Frozen request

The canonical request hash is:

`9b65d45d89ce5ad18eb6f1da316b89cbaba2ae4ea14566dfc5a6b863022b0f9f`

It covers the exact account/profile, POST path, Stripe API, ACP version, helper
capability, PaymentMethod, `usd`/`100`, expiry `1790228100`, zero-payment effects,
and transport policy. Any additional, missing, or changed field is rejected,
including alternate account/version/input/PaymentMethod/SPT capability, retry,
redirect, fallback, resubmit, or more than one attempt.

## Credential metadata gate

Credential retrieval remains injected and outside this package, but the returned
trusted metadata must name exactly `acct_1UDULUFDhOfb5F0F` and must assert
`livemode: false`. Missing metadata, a different account, or any live-mode value
blocks dispatch after permanently consuming the one-shot claim. Credential values
are never persisted or returned.

## Atomic durable one-shot fence

Before either injected credential retrieval or injected dispatch callback runs, the
guard atomically creates a private `stripe-spike-one-shot` directory and writes a
mode-0600 safe claim record. Directory creation is the compare-and-set boundary:
only one concurrent process succeeds. The claim file and containing directory are
`fsync`ed before credential access, making the consumed fence durable across a
process or host interruption. Duplicate, race, stale-lease, and re-anchor attempts
fail before callbacks. The claim remains consumed after credential failure,
dispatch failure, timeout, or ambiguous outcome; there is no reset or retry path.

Only safe approval, lease, clock-authority, and request-hash metadata is persisted.
No credential or raw provider response is stored by the guard. The production
transport returns only allowlisted status/classification fields and irreversible
SHA-256 fingerprints of provider request/object references; raw `req_`, `spt_`, or
other reusable provider identifiers cannot leave the transport boundary.

## Test contract

`test/m3-stripe-spike-guard.test.mjs` verifies:

- selected-NTP command capture, success, parse, unambiguous target binding, numeric offset, ±1-second and 0–60-second boundaries;
- fixed production clock, request, transport, and canonical state path with alternate caller fields rejected;
- exact inclusive outer start and exclusive outer end;
- immutable action lease, outer-end cap, exclusive lease end, repeated boundary checks, and abort at the absolute deadline;
- stable approved hash and exact literal mismatch rejection;
- alternate account/profile/version/ACP/input/PaymentMethod/SPT and unsafe transport rejection;
- exact credential account and test-mode metadata enforcement;
- fixed one-POST transport consuming `authorizeSend` and `AbortSignal` with redirects disabled;
- raw Stripe request and object identifiers replaced by irreversible SHA-256 fingerprints;
- atomic race and duplicate fencing with durable claim synchronization;
- one-shot consumption before fake credential and fake dispatch callbacks;
- no fake credential retrieval or fake dispatch for every pre-dispatch rejection;
- no dispatch after credential-time lease expiry or credential metadata mismatch;
- ambiguous fake dispatch and fake credential failure permanently consume the claim.

The test package performs no provider, vault, credential, webhook, deployment,
hosted-resource, payment, push, PR, or merge action.
