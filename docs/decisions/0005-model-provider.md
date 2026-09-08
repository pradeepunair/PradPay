# ADR-0005: Model provider and structured-tool boundary

- Status: proposed; provider selection pending
- Date: 2026-09-08
- Owner/reviewer: Pradeep Nair / pending

## Context

The public Live Sandbox needs one structured-tool-capable model provider with
bounded calls/tokens, useful usage reporting, stable schema behavior, appropriate
data handling, and spend controls. Replay does not require a model provider.

## Options considered

1. Direct API access to one selected model provider.
2. Vercel AI Gateway restricted to one selected model.
3. Local LM Studio for development only.

The Vercel AI Gateway is visible but unconfigured and currently requests an API
key plus billing-card setup. No direct provider credential is configured in the
task environment. A local model cannot serve the public Vercel deployment.

## Decision criteria

- JSON-schema/structured tool-call reliability and server-side validation.
- Explicit model identifier/version behavior and upgrade control.
- Timeout, cancellation, retry, and usage-reporting behavior.
- Input/output retention, training, regional, and privacy policy.
- Per-run call/token reservation plus account/project spend controls.
- Operational simplicity and failure isolation.

## Proposed decision

Do not select a provider until a small non-payment spike evaluates the criteria
above and the owner approves the account/cost path. Whichever option wins, expose
it through a PaymentLab-owned adapter so prompts, schemas, budgets, evidence IDs,
and role allowlists remain application contracts.
