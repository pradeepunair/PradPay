# PaymentLab AI

PaymentLab AI is a proposed portfolio sandbox for following an agent-led purchase
from intent through test-mode payment confirmation. The product requirements are
in [`PaymentLab-AI-MVP-PRD.html`](PaymentLab-AI-MVP-PRD.html).

- GitHub: [`pradeepunair/PradPay`](https://github.com/pradeepunair/PradPay)
- Vercel project: [`prad7/pradpay`](https://vercel.com/prad7/pradpay)
- Deployed readiness page: [`https://pradpay.vercel.app`](https://pradpay.vercel.app)

Phase 0 implementation has started with a local readiness page and an isolated
`POST /api/webhooks/stripe` route. The route verifies Stripe signatures against
the untouched request body, rejects live-mode events, and acknowledges only the
documented test-event boundary. It does not yet durably store or reconcile
events. The route is deployed at
[`https://pradpay.vercel.app/api/webhooks/stripe`](https://pradpay.vercel.app/api/webhooks/stripe)
and deliberately returns `503` until its endpoint-specific Stripe sandbox
signing secret is configured. No Stripe event destination or test payment has
been created.

The repository also defines how the MVP will be delivered and verified:

- [Phased MVP implementation plan](docs/implementation-plan.md)
- [Visual HTML implementation blueprint](PaymentLab-MVP-Implementation-Plan.html)
- [Architecture and trust boundaries](docs/architecture.md)
- [Experience and design flows](docs/design-flow.md)
- [Live, recovery, and replay data flows](docs/data-flow.md)
- [Logical data model and invariants](docs/data-model.md)
- [Acceptance traceability](docs/traceability.md)
- [Phase 0 capability work packet](docs/phases/phase-0-capability-and-decisions.md)
- [Phase documentation index — Markdown](docs/phases/README.md)
- [Phase documentation index — HTML](docs/phases/index.html)
- [Stripe sandbox credential setup](docs/stripe-sandbox-setup.md)
- [Documentation index and update rules](docs/README.md)

Every Phase 0–5 packet is maintained in Markdown and generated as a
self-contained HTML page. Run `npm run docs:phases` after editing a phase record
and `npm run docs:phases:check` before committing. Run `npm run docs:preview`
to open the phase library through a local-only web server at
`http://127.0.0.1:4173/docs/phases/index.html`.

Run `npm test` and `npm run build` to validate the application. Run `npm run dev`
for the local application preview at `http://127.0.0.1:3000`. Real values for the
names in `.env.example` belong only in an external secret store or an ignored
local `.env.local` file. Never paste Stripe credentials into chat, issues,
commits, or committed environment templates. See the
[Stripe sandbox setup guide](docs/stripe-sandbox-setup.md) for the exact Vercel
locations, environment scopes, and webhook sequence.

Guided Replay and Live Sandbox are separate modes. Replay is read-only. Live
Sandbox, if the Phase 0 capability gate passes, uses bounded agents and Stripe
test mode only; no real money or real fulfillment is part of the MVP.

The conditionally approved Milestone 1 increment is available locally at
`/demo/synthetic-success-v1`. It uses a checked-in synthetic recording, integer
money/domain rules, event-cursor projections, and vendored ACP 2026-04-17
contract artifacts. It needs no Stripe, database, workflow, or model secrets and
cannot submit payments. See [the Milestone 1 plan](docs/m1-implementation-plan.md)
and [ADR-0008](docs/decisions/0008-guided-replay-recording-contract.md).
