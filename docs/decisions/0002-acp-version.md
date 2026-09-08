# ADR-0002: Pin ACP 2026-04-17 at an exact upstream commit

- Status: accepted
- Date: 2026-09-08
- Owner/reviewer: Pradeep Nair / implementation evidence pending owner review

## Context

The PRD named `2026-01-30` as a candidate to verify. The official ACP repository
now identifies `2026-04-17` as the latest stable snapshot and deprecates the
candidate. ACP remains beta and its moving `main` branch contains unreleased work.

## Decision drivers

- Use a released, non-deprecated contract.
- Reproducible generated types and contract tests.
- Accurate public compatibility label.
- Retain upstream license and notices.

## Options considered

1. Pin stable `2026-04-17` plus exact commit/artifact hashes.
2. Keep deprecated `2026-01-30` for PRD literalism.
3. Consume `main` or `unreleased`.

## Decision

Use ACP `2026-04-17` from commit
`7fdd78df677a94dce04c770644b0fbbb1401272b`. Verify artifact SHA-256 hashes
against `protocol/acp/manifest.json`. Do not fetch moving upstream artifacts at
build/runtime. Implement only the checkout operations and capabilities required
by the MVP; payment-handler support is a separate ADR.

## Consequences

- The application gains the stable discovery/authentication/order additions
  introduced after January, while keeping its MVP surface smaller.
- Domain-to-ACP state mapping must target the April schema, not the PRD's example.
- Public copy must say a pinned ACP subset, not generic/full conformance.
- A future ACP upgrade requires a new ADR, regenerated types, migration review,
  contract tests, recordings compatibility review, and updated labels.

## Verification

- Official repository comprehensive validator passed at the pinned commit.
- Each `2026-04-17` JSON Schema compiled independently with AJV draft 2020.
- License is Apache-2.0 and the upstream `NOTICE` names OpenAI and Stripe.
- Detailed hashes and validation nuance are recorded in the manifest and
  `docs/acp-compatibility.md`.
