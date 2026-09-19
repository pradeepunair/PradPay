PaymentLab AI — Milestone 1 QA review

Review timestamp: 2026-09-18 CDT
QA owner: Tab
Candidate branch: feat/m1-replay-domain
Candidate commit: 6f91452bb13ee6ea6526df16b27b237394ef67b8
Commit: feat: add synthetic guided replay foundation
Worktree: /Users/pradeepnair/Documents/GitHub/PRADPAY-impl
Worktree status at start: clean, branch matches candidate

Contracts and scope

- Parent: PaymentLab AI MVP PRD v1.0, embedded source dated 2026-09-07
- Scoped M0.1 handoff
- Phase packet: docs/phases/phase-1-domain-and-guided-replay.md
- Design flow: docs/design-flow.md (proposed design; no separately accepted design artifact supplied)
- ADR: docs/decisions/0008-guided-replay-recording-contract.md
- ACP: 2026-04-17, commit 7fdd78df677a94dce04c770644b0fbbb1401272b
- Seed data: public/replays/synthetic-success-v1.json only
- Boundary: synthetic Guided Replay/domain foundation and pinned ACP contract scaffolding only

No deploy, push, credential/resource mutation, Stripe call, database/workflow call, real customer data, or payment was performed.

Traceability and result counts

Planned: 18 checks
Executed: 18
Blocked: 0
Skipped: 0

| ID | Criterion/risk | Evidence | Result |
| --- | --- | --- | --- |
| QA-M1-01 | Candidate identity | git HEAD and branch read: exact 6f91452... on feat/m1-replay-domain; clean worktree. | PASS |
| QA-M1-02 | A01 mutation/dependency isolation | npm test replay transitive dependency and package/path-alias isolation tests pass; replay imports only local replay/reducer/store plus approved framework/runtime dependencies. | PASS |
| QA-M1-03 | A01 no external runtime | Source and fixture describe Guided Replay as synthetic/no live calls; route is static SSG. | PASS |
| QA-M1-04 | A02 rewind boundary | Unit test passes: cursor 6 shows payment not_submitted and null provider reference; end cursor shows succeeded and pi_demo_ reference. | PASS |
| QA-M1-05 | A02 future-event handling | Unit test passes: unknown future event remains visible as safe timeline fact but cannot mutate projection. | PASS |
| QA-M1-06 | A02 restart/timing | Replay reached cursor 10; end control changes to Replay; timing implementation uses recorded event timestamps with bounded delays and speed factor. | PASS |
| QA-M1-07 | A22 fixture secret safety | Credential-pattern test passes; independent repository content scan found no sk/rk/pk live/test secret, whsec, or spt values. .env.local is ignored and not tracked. | PASS |
| QA-M1-08 | A23 ACP operation surface | Contract test passes for five approved checkout operation IDs/endpoints. | PASS |
| QA-M1-09 | A23 exact hashes | Contract test passes for every vendored ACP artifact SHA-256 and rejects partial/repointed manifests. | PASS |
| QA-M1-10 | A25 keyboard semantics | Native buttons, range input, select, labels, aria-pressed perspective tabs, aria-current event item, and explicit control aria-labels present; controls are reachable in DOM order. | PASS |
| QA-M1-11 | A25 mobile semantics | Browser at 390x844: page rendered, controls remained available, `scrollWidth == innerWidth` (no horizontal overflow). | PASS |
| QA-M1-12 | A25 perspective behavior | Buyer, Merchant, Provider, and All views controls rendered; All views selection rendered all perspective headings. | PASS |
| QA-M1-13 | A28 quote total | Unit test exact `totalMinor: 30319`; browser cursor 6 showed `$303.19`. | PASS |
| QA-M1-14 | A28 fee | Unit test exact `processorFeeMinor: 909`; fixture provider fee assumption is 909 cents. | PASS |
| QA-M1-15 | A28 contribution | Unit test exact `contributionMinor: 6991`; fixture merchant contribution is 6991 cents. | PASS |
| QA-M1-16 | Build/dependency health | npm ci: 32 packages installed, 33 audited, 0 vulnerabilities; TypeScript noEmit passed; Next build passed. | PASS |
| QA-M1-17 | Docs/reproducibility | docs:phases:check passed: 7 generated phase pages current; six Markdown/HTML pairs, template, navigation, structure, and links validated. | PASS |
| QA-M1-18 | Local route smoke | GET localhost:3100/ and /demo/synthetic-success-v1 returned HTTP 200 text/html; SSG route `/demo/synthetic-success-v1` reported by build. | PASS |

Automated execution evidence

Command: npm ci
Result: PASS; 32 packages added, 33 audited, 0 vulnerabilities.

Command: npm run docs:phases:check
Result: PASS; generated phase pages current; phase validation passed.

Command: npm test
Result: PASS; 26 tests, 26 pass, 0 fail, 0 skipped.

Command: npx tsc --noEmit
Result: PASS; no TypeScript errors.

Command: npm run build
Result: PASS; Next.js 16.3.4/Turbopack compiled; TypeScript completed; 4/4 static pages generated; SSG route `/demo/synthetic-success-v1`; expected routes `/`, `/_not-found`, `/api/webhooks/stripe`, and `/demo/[runId]` reported.

Runtime/browser evidence

- Local server: http://localhost:3100
- Desktop viewport: 1280x633 browser viewport; title `PaymentLab AI — Guided Replay`.
- Initial state: Cursor 0, Mission, payment `not_submitted`, no event-derived facts.
- Next control: advanced to Cursor 1 and displayed only event 1.
- End control: advanced to Cursor 10; phase Confirmation, payment succeeded, order confirmed.
- Rewind: four Previous Event actions returned to Cursor 6; text showed `paymentStatus=not_submitted`, no `pi_demo_synthetic_001`, and no synthetic succeeded provider state.
- Mobile viewport: 390x844; page rendered without horizontal overflow; stacked layout and footer controls remained available.
- Perspective controls: Buyer, Merchant, Provider, and All views rendered; headings included Intent and authority, Quote and economics, and Submission and callback.
- Browser screenshot evidence: `/Users/pradeepnair/.config/browser-harness/tmp/shot.png` (latest mobile capture; ephemeral harness path).

Defects

No reproducible product defects found within the authorized M1 scope.

Coverage gaps and residual risks

- No separately accepted design artifact was supplied; visual/accessibility review is bounded to design-flow checkpoints and manual desktop/mobile smoke.
- No screen-reader session, automated WCAG scanner, or physical-device test was run.
- Integrated recording publication, live agents, payment/Stripe, persistence, workflow durability, endpoint-level ACP behavior, and production/deployment behavior remain explicitly deferred.
- Browser console/error capture was not available through the current harness; automated build/tests and route probes passed.
- No claim is made for live payment, real callback behavior, durable receipts, or ACP end-to-end conformance.

Disposition

PASS for the authorized synthetic M1 replay/domain and pinned ACP contract-scaffolding scope.

PASS is limited to the exact candidate commit and local environment above. Do not promote this disposition to Live Sandbox, production, integrated recording publication, persistence/workflow readiness, or endpoint-level ACP readiness.

Next owner

Emily: retain candidate evidence and address later-phase gates. Pixel/Product: supply or accept a design artifact before broader visual/accessibility sign-off. Future QA: retest integrated recording, persistence/workflow, endpoint ACP, and payment gates on a new candidate.
