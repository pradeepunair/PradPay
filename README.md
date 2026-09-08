# PaymentLab AI

PaymentLab AI is a proposed portfolio sandbox for following an agent-led purchase
from intent through test-mode payment confirmation. The product requirements are
in [`PaymentLab-AI-MVP-PRD.html`](PaymentLab-AI-MVP-PRD.html).

Implementation has not started. The current repository additions define how the
MVP will be delivered and verified:

- [Phased MVP implementation plan](docs/implementation-plan.md)
- [Architecture and trust boundaries](docs/architecture.md)
- [Experience and design flows](docs/design-flow.md)
- [Live, recovery, and replay data flows](docs/data-flow.md)
- [Logical data model and invariants](docs/data-model.md)
- [Acceptance traceability](docs/traceability.md)
- [Phase 0 capability work packet](docs/phases/phase-0-capability-and-decisions.md)
- [Documentation index and update rules](docs/README.md)

Guided Replay and Live Sandbox are separate modes. Replay is read-only. Live
Sandbox, if the Phase 0 capability gate passes, uses bounded agents and Stripe
test mode only; no real money or real fulfillment is part of the MVP.
