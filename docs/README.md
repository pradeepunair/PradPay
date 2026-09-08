# PaymentLab AI documentation

This directory turns the product requirements in
[`PaymentLab-AI-MVP-PRD.html`](../PaymentLab-AI-MVP-PRD.html) into a living
implementation record. The PRD remains the product contract. These documents
explain how the team intends to deliver it and must be updated as implementation
evidence replaces assumptions.

The repository root also contains a self-contained
[`PaymentLab-MVP-Implementation-Plan.html`](../PaymentLab-MVP-Implementation-Plan.html)
for visual review and printing. Every phase also has a generated, self-contained
HTML companion. Markdown remains the editable source of truth.

## Document map

| Document | Purpose | Update rule |
| --- | --- | --- |
| [MVP implementation plan](implementation-plan.md) | Phases, work packages, dependencies, gates, and definition of done | Update when scope, sequencing, or gate status changes |
| [Architecture](architecture.md) | Components, trust boundaries, runtime responsibilities, and open decisions | Update in every phase that changes a component or deployment boundary |
| [Experience and design flows](design-flow.md) | Guided Replay, Live Sandbox, consent, recovery, and accessibility flows | Update with every user-visible behavior change |
| [Data flows](data-flow.md) | Write paths, evidence propagation, webhook processing, replay, and retention | Update with every integration or data-boundary change |
| [Data model](data-model.md) | Core records, relationships, state separation, and invariants | Update with every migration or state-machine change |
| [Acceptance traceability](traceability.md) | Maps PRD checks A01-A28 to phases, test layers, and evidence | Update when a test is implemented or evidence is captured |
| [ACP compatibility record](acp-compatibility.md) | Verified protocol revision, operations, handler, and credential boundary | Populate during Phase 0; update only from compatibility evidence |
| [Phase 0 environment inventory](phase-0-environment-inventory.md) | Verified repository, platform, account, tool, and dependency facts | Update only from current read-only checks or executable evidence |
| [Threat model](threat-model.md) | Assets, trust boundaries, abuse cases, controls, and validation | Revisit whenever a boundary, integration, or public capability changes |
| [Architecture decisions](decisions/README.md) | ADR register and decision-writing rules | Add an ADR before implementing a consequential choice |
| [Phase record template](phases/PHASE-TEMPLATE.md) | Repeatable phase brief, change log, evidence, and handoff | Copy when a phase starts; close it at the exit review |
| [Phase 0 work packet](phases/phase-0-capability-and-decisions.md) | Discovery checklist, evidence register, and gate review | Use as the active record when Phase 0 begins |
| [Phase records and HTML index](phases/README.md) | Paired Markdown/HTML records for Phases 0–5 and generation commands | Regenerate and commit HTML with every phase Markdown change |

## Documentation-as-delivery rule

A phase is not complete when code merely works locally. Its exit gate also
requires:

1. Changed components and boundaries reflected in the diagrams.
2. New or changed API, event, and data contracts recorded.
3. Consequential choices recorded as ADRs, including rejected options.
4. Applicable A01-A28 rows linked to repeatable test evidence.
5. Operational, security, privacy, and rollback impacts documented.
6. The phase record closed with known limitations and the next-phase handoff.
7. `npm run docs:phases:check` passes and the generated HTML is visually reviewed.

Phase HTML is generated with `npm run docs:phases`; generated files must not be
edited directly. Commit each phase's Markdown and HTML versions together.

Sensitive values, full provider payloads, payment credentials, personal data,
and hidden model reasoning do not belong in documentation or test evidence.

## Status vocabulary

- **Proposed**: derived from the PRD but not verified against the implementation environment.
- **Verified**: confirmed against an authoritative artifact, account, deployment, or executable test.
- **Implemented**: present in code and covered by the named test.
- **Released**: deployed to the documented environment and checked there.
- **Blocked**: cannot proceed without a named decision, capability, or authority.
