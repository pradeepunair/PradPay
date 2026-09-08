# ADR-0003: Stripe test credential and ACP payment-handler path

- Status: proposed; blocked on authenticated account spike
- Date: 2026-09-08
- Owner/reviewer: Pradeep Nair / pending

## Context

ACP completion expects negotiated payment data. Stripe documents Shared Payment
Tokens (SPTs), including a test helper that simulates a granted SPT and a
PaymentIntent confirmation using that SPT, but labels agentic commerce/SPT as
private preview. Documentation does not prove access for the owner's account.

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

- Owner signs in and identifies the intended isolated Stripe test/sandbox account.
- Verify availability without copying keys into chat, Git, docs, logs, or model context.
- Create one small fictional test payment with a stable idempotency key.
- Receive and signature-verify a callback, recording only safe references.
- Confirm no live-mode object and no real money movement.

## Consequences

The ADR cannot be accepted from documentation alone. Until the spike passes,
Phase 1 replay can proceed but Phase 3 Live Sandbox completion remains blocked.
