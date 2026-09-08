# ADR-0003: Stripe test credential and ACP payment-handler path

- Status: proposed; sandbox verified, blocked on key rotation and SPT API spike
- Date: 2026-09-08
- Owner/reviewer: Pradeep Nair / pending

## Context

ACP completion expects negotiated payment data. Stripe documents Shared Payment
Tokens (SPTs), including a test helper that simulates a granted SPT and a
PaymentIntent confirmation using that SPT, but labels agentic commerce/SPT as
private preview. The dedicated `PradPay sandbox` is now verified, with no API
activity or event destination, but dashboard access does not prove SPT entitlement.

## Options considered

1. Actual supported SPT test-helper path mapped to the pinned ACP handler.
2. Another documented handler/credential path allowed by the pinned schema.
3. ACP checkout subset plus a clearly separate custom Stripe sandbox completion.
4. Replay-only release until an account-supported path exists.

## Proposed decision

Prefer option 1 only if the intended Stripe sandbox/test account successfully
creates an SPT through the documented test helper and uses it for one tiny
automatic-capture PaymentIntent. Otherwise choose the narrowest verified
alternative and use the exact PRD-required compatibility label. Never construct
an `spt_` value or substitute a PaymentMethod ID.

## Required spike

- Rotate the standard test secret exposed through accessibility output and store
  its replacement only in the isolated secret environment.
- Test the SPT helper against the account using an explicitly pinned API version.
- Create one USD 1.00 fictional test payment with a stable idempotency key.
- Register the isolated HTTPS event destination and only the required payment/SPT events.
- Receive and signature-verify a callback, recording only safe references.
- Confirm no live-mode object and no real money movement.

## Consequences

The ADR cannot be accepted from documentation alone. Until the spike passes,
Phase 1 replay can proceed but Phase 3 Live Sandbox completion remains blocked.
