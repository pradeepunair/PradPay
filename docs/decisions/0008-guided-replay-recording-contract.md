# ADR-0008: Versioned static recording contract for Guided Replay

- Status: accepted for Milestone 1
- Date: 2026-09-16
- Owner/reviewer: Engineering / Product review pending

## Context

Guided Replay must work without database, workflow, model, ACP, or Stripe access; rewind must reconstruct only facts available at the selected cursor. Integrated recordings do not yet exist, so M1 needs honest synthetic fixtures that can later be replaced without rewriting the reducer or UI.

## Decision

Store immutable recording JSON under `public/replays/` with explicit semantic `schemaVersion`, stable slug, `guided_replay` mode, `synthetic_development_fixture` source label, reference time, fictional catalog, and contiguous append-only event sequences. Validate event timestamps against ordering and declared duration, and validate allowlisted projection fields by value type. The reducer applies only known event types through the selected sequence. Unknown event types remain visible as safe timeline facts but cannot mutate projections.

The server-side recording store validates the allowlisted slug and structure before serializing a fixture into the client replay workspace. Replay modules import no live adapter and perform no network mutation. The M1 fixture contains fictional provider references only, never credentials or claims of an actual payment.

## Alternatives

1. Hard-code independent view snapshots: rejected because perspectives can diverge and rewind can leak future facts.
2. Fetch replay from the live run API/database: rejected because it couples public replay availability to unverified mutable infrastructure.
3. Static versioned event recording with deterministic projections: selected.

## Consequences

- M1 is fully local and secret-free.
- All views share one event cursor and reducer.
- Schema upgrades require compatibility tests and a new recording version.
- Static publication still requires a later sanitization gate before synthetic fixtures can be relabeled as recorded integrated runs.

## Verification

Unit tests cover sequence validation, source labeling, no-future projection, unknown events, mutation isolation, and credential-pattern scanning. Build and browser checks cover the interactive workspace.

## Rollback

Remove the static recording, replay modules/routes, and this ADR. No database or remote resource rollback is required.
