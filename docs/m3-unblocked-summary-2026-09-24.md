# M3 Milestone — Unblocked Local Gates (2026-09-24)

## Bottom line

All 186 local tests pass at candidate `b9a480c`. Every entry/exit gate is either
**VERIFIED LOCAL**, **PARTIAL (local)**, or **BLOCKED externally**. No external side
effect has been taken. Phase 3 documentation is current and internally consistent.

## What is ready

| Gate | Status | Evidence |
|---|---|---|
| E02 M0/M2 baseline | VERIFIED LOCAL | 186/186 tests pass; M2 traceability intact |
| E06 DB/runtime | VERIFIED LOCAL (migration) | M2/M3 migrations, constraints, rollback, concurrency pass in disposable container |
| E07 Callback (local) | VERIFIED LOCAL | Local composition: untouched bytes, dedup, rollback |
| E08 Workflow (local) | VERIFIED LOCAL | Transactional outbox, deterministic runner interfaces |
| E09 Safety (local) | VERIFIED LOCAL | Kill-switch, budgets, zero-call refusal, crash recovery, reconciliation continuity |
| X01–X09 (local invariants) | VERIFIED LOCAL | Concurrency, idempotency, signature, timeout, cash-out, auth flow, kill, ACP label |
| X10 Docs | VERIFIED LOCAL | 7 phase pages generated; link/structure validation pass |
| X11 Build/quality | VERIFIED LOCAL | `npm ci` → 32 pkgs, 0 vulns; TypeScript, build, diff clean |
| M3-GATE-DOC-001 | COMPLETED | Gate matrix, evidence template, acceptance traceability, ADR-0003 packet committed and pushed |

## What is NOT ready (and cannot be unblocked locally)

| Gate | Blocker | Required from you |
|---|---|---|
| E01 Written authorization | No Pete/Product + Prads approval for bounded external scope | Approve the M3-GATE-DOC-001 packet (this page) |
| E03 E04 Stripe capability spike | No authenticated SPT call; exposed test secret not rotated | Rotate secret → authorize Riley → execute the capability-only spike (no payment) |
| E05 Isolated env | No deployed callback URL, deployment provenance, hosted DB | Approve Vercel staging + hosted PostgreSQL (Neon/Supabase) |
| E07 Callback deployment | No stable HTTPS endpoint, endpoint registration | Deploy the staging endpoint after E03 result |
| E08 Durable runner | No hosted runner/worker selected | Approve a runner (Fly/Render) after E03 |
| X01/X03/X04/X06/X07/X09/X11 deployed | All require a deployed target and authorized Stripe test object | After E05/E07/E08 approved, execute |

## The exact sequence

```
You approve this page (E01)
    → You rotate the exposed Stripe test secret outside Git/chat/model
    → You authorize the one-shot SPT spike (no payment, no deployment)
    → Riley calls the documented Stripe test helper → result → ADR-0003 decided
    → You approve hosted env (Vercel staging + DB + runner)
    → Riley deploys endpoint, registers webhook, verifies signed delivery
    → You authorize one USD 1.00 test payment
    → Tab QA deployed build → Pete/Product acceptance
```

## Immediate next packet

A fresh SPT capability-spike packet is available in `PRADPAY-m3-stripe-spike-prep`
(branch `docs/m3-stripe-capability-spike-prep`, commit `bd5cfe7`) with a new
execution window `2026-09-24T21:00:00-05:00` through `2026-09-24T23:00:00-05:00`.
It contains no credentials, no payment, no deployment — only a one-shot capability
helper call to determine whether the sandbox supports SPT/delegate payment.
