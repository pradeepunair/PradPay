PaymentLab AI — M3.1 entry/exit gate matrix

Review identity

- Review timestamp: 2026-09-21 08:11:25 CDT (-0500).
- Exact reviewed candidate: `b9a480c353a7123c4680aec3ed5b442c8ceaa821`.
- Branch/worktree: `feat/m3-local-synthetic` at `/Users/pradeepnair/Documents/GitHub/PRADPAY-m3-local`.
- Governing contract: `/Users/pradeepnair/Documents/GitHub/PRADPAY-m3-local/docs/product/paymentlab-ai-m3-readiness.md`, version `M3.1-readiness`.
- QA report: `/Users/pradeepnair/Documents/GitHub/PRADPAY-m3-qa-review-b9a480c.md`.
- Candidate state at review: tracked HEAD had no staged or unstaged diff. The M2 and M3.1 Product authority documents are absent from the commit, remain present as external reviewed inputs, and are now ignored through repository-local Git metadata. Tab observed them as untracked before that local accounting step; no claim is made that they belong to the candidate tree.
- Package: `M3-GATE-DOC-001`; documentation/local inspection only.
- Review boundary: documentary/local inspection only. No credential access/change, Stripe/provider call, webhook destination, hosted-resource mutation/provisioning, deployment, DNS change, payment, Live Sandbox action, push, PR, or merge.

Input integrity

| Artifact | Status/version | SHA-256 |
| --- | --- | --- |
| `docs/product/paymentlab-ai-m3-readiness.md` | M3.1-readiness; external reviewed authority input | `b8ce25060c035f74c23294c03ae7622be0766aa927c6d97ef37c354c45fccc3e` |
| `docs/product/paymentlab-ai-m2-acceptance.md` | M2.0 acceptance; external reviewed authority input | `38fd76340fc2f068e310358181af10e2ad964b4a56d02d70cd1c8c7def172e17` |
| `docs/decisions/0003-stripe-payment-path.md` | proposed/blocked; corrected package artifact | `0121e90bd9b051e58fc1ad5edcd917ccde3411ad52456fc4291ff61dfd469084` (pre-package input: `f7459da50b2528c53800a16956ce7677d446bdeca464f8ab40d7f2949fd02e59`) |
| `docs/decisions/0004-durable-workflow.md` | accepted for local fallback; hosted runner unselected | `403dbb75de0375b56a019d48563524183f2d9b1cff97a25d0963e01b096fa45c` |
| `docs/decisions/0007-database-and-orm.md` | proposed | `1424c0a6a59688ea2fcb7b871b285521f8b013895651bdd5a6611105fa24725c` |
| `docs/m3-local-integration-evidence.md` | exact-candidate local evidence | `38a6f1d0a5ce51dae15b5978de92f8648d65d4a6cc1ef436c82f14d84643c041` |
| `/Users/pradeepnair/Documents/GitHub/PRADPAY-m3-qa-review-b9a480c.md` | Tab PASS, bounded local synthetic scope | `4a8d60b4989a6797fc41bc30db1293361003da1f5a0aa4df0fabe885e022cf0a` |

Status vocabulary

- `VERIFIED LOCAL`: satisfied for the bounded local/disposable/synthetic scope only.
- `PARTIAL`: local or historical evidence exists, but the exact M3 gate requires additional owner/account/hosted/provider evidence.
- `BLOCKED`: a required prerequisite or proof is absent and cannot be produced under current authority.
- No `VERIFIED LOCAL` result implies provider, hosted, deployed, payment, Product acceptance, or release readiness.

Approval roles

- Pete/Product owns contract authorization, Product decisions, compatibility labels, safety defaults, and acceptance.
- Prads, acting as the relevant account/resource owner, owns credential rotation/custody actions, account selection, spending/test-budget approval, hosted-resource approval, deployment approval, and payment authorization immediately before each action.
- Hermes coordinates the handoffs and preserves the authorization boundary; coordination is not a substitute for Product or account-owner approval.
- Emily owns engineering integration and candidate evidence; Dax owns approved database work; Riley owns approved provider/webhook/reliability work.
- Tab independently validates an exact candidate or deployed build after its prerequisites are authorized.

Entry-gate matrix

| Gate | Status | Concrete evidence | Missing proof / blocker | Next owner and approval |
| --- | --- | --- | --- | --- |
| M3-E01 Product/owner authorization | PARTIAL | M3.1 records the corrected requirement: `written acceptance of this M3 contract`, plus exact local worktree/branch, zero-spend local synthetic scope, and prohibitions. Candidate `b9a480c` is QA-passed. Evidence: `docs/product/paymentlab-ai-m3-readiness.md:20,144-157`; `docs/m3-local-engineering-plan.md:3-18`; QA report lines 6-22. | No written authorization for credentials, provider calls, webhook registration, hosted resource changes, deployment, test payment, exact external test budget, or named staged environment. | Pete/Product must authorize the bounded external scope; Prads/account owner must approve account, credentials, resources, budget, deployment, and payment immediately before action; Hermes coordinates; Emily executes only the approved package. |
| M3-E02 M0/M2 baseline | VERIFIED LOCAL | M2 acceptance identifies exact candidate `f50d896...`; M3 preserves traceability. M3 full suite 186/186, focused 80/80, migration/rollback/concurrency/cleanup, ACP hard blocks, outbox/idempotency, and no unresolved local defect are reproducible. Evidence: `docs/product/paymentlab-ai-m2-acceptance.md:3-40`; `docs/m3-local-integration-evidence.md:46-83`; QA report lines 24-64. | No external M2/hosted claim is made or needed for this local status. | Emily preserves exact evidence; Tab reruns after any candidate change. |
| M3-E03 ADR-0003 acceptance | BLOCKED | ADR-0003 exists and truthfully remains `proposed`; it names the controlled spike and safe fallback. Evidence: `docs/decisions/0003-stripe-payment-path.md:1-43`; `docs/product/paymentlab-ai-m3-readiness.md:24,57-68`. | Authenticated Stripe test-account spike absent; previously exposed test secret rotation unverified; account/test-mode evidence, selected path, exact versions, credential custody, callback, safe references, reviewer/date absent. | Prads/account owner must rotate securely and approve credential/provider use; Riley executes only after exact approval; Pete/Product and the named reviewer accept or record the blocker. |
| M3-E04 Provider capability decision | BLOCKED for a sale; safe replay-only default verified | ACP `2026-04-17` subset is pinned; complete/delegate-payment are hard-blocked; handlers are empty; compatibility label is truthful. Environment inventory records SPT entitlement as unknown. Evidence: `docs/acp-compatibility.md:8-19,122-150`; `docs/phase-0-environment-inventory.md:62-88`; ADR-0003 lines 15-28. | No authenticated account evidence establishes SPT/delegate-payment or another handler. ADR-0003 has not formally selected an accepted account-supported path. | Pete/Product decides whether to pursue SPT, custom completion, or replay-only; Prads/account owner authorizes the account capability spike; Riley executes after approval. |
| M3-E05 Isolated environment | BLOCKED | Historical inventory records a dedicated `PradPay sandbox`, Vercel project, and public route, but this was not freshly account-read for this gate review and has no source-commit-to-deployment mapping for `b9a480c`. Evidence: `docs/phase-0-environment-inventory.md:34-60,62-88`; QA report lines 73-80. | Exact approved Stripe profile, ownership, current test-mode verification, named isolated preview/staging build, callback URL, deployment provenance, and test budget are not established for this candidate. | Pete/Product names the intended stage; Prads/account owner approves account/environment, budget, and any deployment; Hermes coordinates read-only verification; deployment requires separate immediate approval. |
| M3-E06 Database and durable runtime | PARTIAL local; BLOCKED hosted | Additive M2/M3 PostgreSQL migrations, constraints, row locks, idempotency, outbox, reconciliation, rollback rehearsal, concurrency, and cleanup pass in the existing disposable local container. Evidence: `docs/m3-local-integration-evidence.md:46-87`; `docs/decisions/0007-database-and-orm.md:44-77`; QA report lines 24-48. | No approved hosted DB/provider/region/plan, concrete runtime pool/driver, credentials, pooled/direct behavior in target, backups/restore, retention, operator access, RPO/RTO, cost, or deployed migration evidence. `npm ci`/new dependency verification is blocked by the ecosyste.ms threat-intelligence metadata timeout; no bypass occurred. | Pete/Product approves the target requirement; Prads/resource owner approves provider/region/plan/cost and creation; Dax executes the hosted DB spike; Emily owns the reviewed dependency decision after scanner availability. |
| M3-E07 Callback and secret controls | PARTIAL local; BLOCKED external | Local composition verifies untouched bytes, timestamp and `livemode:false`, persists receipt before acknowledgement, deduplicates, handles out-of-order evidence, requires transaction-scoped authorization, and rolls back on failures. Evidence: `docs/m3-local-reliability-runbook.md:53-77`; QA report lines 35-44,50-60. | No stable candidate-mapped HTTPS callback, endpoint registration, endpoint-specific secret custody, provider-signed event, current reachability proof, or provider retry evidence. | Pete/Product approves the bounded callback evidence requirement; Prads/account owner approves deployment, destination, and secret custody; Riley executes after secure injection and exact approval. |
| M3-E08 Workflow/reconciliation durability | PARTIAL local; BLOCKED hosted | Transactional outbox, lease/fence/retry, unknown-attempt recovery, admission-disabled reconciliation, and deterministic runner interfaces are locally verified. ADR-0004 accepts only the local fallback. Evidence: `docs/decisions/0004-durable-workflow.md:14-62`; `docs/m3-local-reliability-runbook.md:83-117`; QA report lines 52-60. | Hosted runner/worker unselected and unexercised; browser/process/deployment loss, callback wake, retention, quotas, cost, observability, version migration, and operator behavior are unverified. | Pete/Product selects required durability behavior; Prads/resource owner approves runner, budget, and hosted activation; Riley executes the reliability spike. |
| M3-E09 Safety controls | PARTIAL / VERIFIED LOCAL | Default-closed kill switch, durable refusal, count/amount budgets, attempt fencing, zero-provider-call refusal, correlation IDs, fail-closed adapters, diagnostics-safe fields, and replay-only rollback are tested. Kill switch does not block verified receipt/reconciliation. Evidence: `docs/m3-local-reliability-runbook.md:15-33,79-117`; QA report lines 50-60; M3.1 lines 39-41,134-153. | Approved external defaults for anonymous/session/model/payment budgets, reconciliation horizon, operator roles/alerts, and behavior in the named hosted environment are absent. M3.1 itself states external E03–E09 remain unsatisfied. | Pete/Product approves defaults and horizon; Prads/resource owner approves operational alert/resource effects; Emily coordinates bounded Dax/Riley implementation; Tab verifies the exact deployed candidate. |

Exit-gate matrix

| Gate | Status | Concrete evidence | Missing proof / blocker | Next owner and approval |
| --- | --- | --- | --- | --- |
| M3-X01 At-most-one test payment/order | BLOCKED externally; local invariant evidence exists | Durable stable attempt, one-active-attempt/one-success constraints, atomic budget/attempt claim, idempotent synthetic effect and reconciliation pass. Evidence: `docs/m3-local-integration-evidence.md:46-83`; QA report lines 50-60; `test/m3-data-postgres.test.mjs`; `test/m3-reliability-safety-synthetic.test.mjs`. | No authorized Stripe test payment or provider-confirmed order exists. | Pete/Product must approve the acceptance path; Prads/account owner must authorize the exact USD 1.00 test and account use after E03–E08; Riley executes; Tab verifies. |
| M3-X02 Invalid authority and one dispatch winner | PARTIAL | Local ownership, changed-hash conflict, budget/kill refusal, terminal/fabricated attempt rejection, locks, and concurrent reservation tests produce zero synthetic provider calls. Evidence: QA report lines 50-59; `test/m3-data-postgres.test.mjs`; `test/m3-reliability-safety-synthetic.test.mjs`; `test/m3-integration-contracts.test.mjs`. | Expired/revoked/changed-cart/above-limit mandate cases and concurrent provider dispatch have not been exercised against Stripe in a deployed target. | Emily/Dax may add missing purely local authority cases; Pete/Product and Prads/account owner must authorize provider/deployed proof. |
| M3-X03 Provider test mode/no real money | BLOCKED | Code rejects `livemode:true`; all current evidence is synthetic/local. Evidence: QA report lines 14-22,50-60; `test/m2-reliability-webhook.test.mjs`; `docs/m3-local-reliability-runbook.md:53-75`. | Provider-native test-mode evidence and no-real-money assertion for an actual authorized test object are absent. | Prads/account owner authorizes account and exact test action; Riley executes; Pete/Product and Tab review redacted evidence. |
| M3-X04 Signed durable callback | PARTIAL | Generated-signature local tests prove raw-byte verification, receipt-before-ack, event-ID uniqueness, duplicate/out-of-order safety, and failure rollback. Evidence: QA report lines 35-44,50-60; `test/m3-reliability-webhook-composition.test.mjs`; `docs/m3-local-reliability-runbook.md:53-77`. | No provider-signed delivery, endpoint-secret custody, registered destination, or provider retry trace. | Pete/Product approves evidence scope; Prads/account owner authorizes deployment, destination, and secret custody; Riley executes; Tab verifies. |
| M3-X05 Callback-before-response/timeout convergence | PARTIAL | Synthetic callback-before-response and timeout-after-effect preserve the original attempt, mark unknown, schedule exactly one reconciliation action, and create no replacement. Evidence: QA report lines 52-59; `test/m3-reliability-safety-synthetic.test.mjs`; `docs/m3-local-reliability-runbook.md:83-113`. | Provider lookup/evidence truth and same-key recovery against Stripe are unverified. | Pete/Product and Prads/account owner must authorize E03–E08; Riley executes provider recovery proof; Tab verifies. |
| M3-X06 Requires-action/authentication | PARTIAL local; BLOCKED pending capability spike and formal Product/ADR decision | Synthetic `requires_action` exists; ACP payment operations and handlers remain blocked, so browser/model assertions cannot confirm payment. Evidence: `docs/acp-compatibility.md:98-135`; `docs/m3-local-reliability-runbook.md:35-51`; QA report lines 52-58. | No account-supported hosted authentication flow, persisted wait/resume in a deployed runner, or formally accepted unsupported-provider label in ADR-0003. | Pete/Product chooses the supported flow or explicit unsupported label after an account-owner-authorized capability spike; Riley executes; Tab verifies. |
| M3-X07 Real uncertain-response injection | BLOCKED | Local allowlisted fault scenarios and exactly-one synthetic effect pass. Evidence: QA report lines 52-55; `test/m3-reliability-safety-synthetic.test.mjs`; `docs/m3-local-reliability-runbook.md:35-51,83-91`. | Gate requires one actual test mutation with response suppression and reconciliation of the same provider attempt; no provider mutation is authorized. | Pete/Product approves the gate; Prads/account owner authorizes exactly one bounded payment, secure credentials, and deployed target; Riley executes; Tab verifies. |
| M3-X08 Kill/budget/crash/retry/deployment interruption | PARTIAL | Local kill/budget, browser-independent persisted records, lease/fence/retry, crash-after-commit simulation, and reconciliation continuity pass. Evidence: `docs/decisions/0004-durable-workflow.md:30-62`; QA report lines 52-60; `test/m2-reliability-outbox-workflow.test.mjs`; `test/m3-reliability-safety-synthetic.test.mjs`. | Deployment interruption, hosted worker loss, operator visibility/alerts, and target limits/cost are unverified. | Pete/Product sets durability criteria; Prads/resource owner approves hosted DB/runner/deployment and budget; Riley/Dax execute; Tab verifies. |
| M3-X09 ACP/payment compatibility truth | PARTIAL / VERIFIED LOCAL label | Pinned ACP `2026-04-17`; accurate label states create/retrieve/update/cancel only; complete/delegate-payment blocked; handlers empty. Evidence: `docs/acp-compatibility.md:8-19,21-32,122-150`; QA report lines 56-58. | Actual payment path, Stripe API/preview version, handler declaration, and account capability are unresolved. | Pete/Product accepts the capability result and label after a Prads/account-owner-authorized spike; Pixel reviews user-facing wording if behavior changes. |
| M3-X10 PRD evidence and current docs | PARTIAL | Local QA report, integration evidence, runbook, data model/flow, compatibility record, threat model, generated Phase 3 docs, and A-check index exist. Evidence: `docs/m3-local-integration-evidence.md`; QA report; `docs/m3-local-reliability-runbook.md`; `docs/data-flow.md`; `docs/phases/phase-3-stripe-sale-and-recovery.md`; `docs/m3-acceptance-traceability.md`. | Phase 3 now truthfully reports local synthetic QA and blocked external entry; repeatable provider/deployed evidence and Product acceptance remain incomplete. | Pete/Product reviews this documentation package. Any expansion into external action requires the exact Product/account-owner approvals named by the affected gate. |
| M3-X11 Complete quality and deployed smoke | PARTIAL local; BLOCKED deployed | Focused 80/80, full 186/186, TypeScript, docs, build, diff, credential/redaction pattern scan, migration/race/idempotency/recovery, and zero disposable DBs pass at `b9a480c`; Tab reports no defects. Evidence: QA report lines 24-48,50-80; `docs/m3-local-integration-evidence.md:46-96`. | Package-install/threat-intelligence verification is incomplete because `npm ci` was blocked by the ecosyste.ms metadata timeout; no bypass occurred. Also absent: approved concrete pg driver, browser acceptance, configured deployed sandbox smoke, provider account evidence, and exact deployment provenance. | Emily retries dependency verification only when the scanner is available; Pete/Product and Prads/resource owner approve hosted dependencies/environment/deployment; Tab tests the exact deployed build. |

Local/documentation work that can proceed without external side effects

1. Create a tracked gate matrix from this review, preserving `b9a480c` as the QA baseline and clearly separating local, historical, proposed, and external evidence.
2. Restructure ADR-0003 as a review-ready blocked decision packet without marking it accepted: verified facts, assumptions, unresolved owner questions, capability decision tree, secure evidence placeholders, rollback, and ordered spike procedure. Do not add credentials, secret values, account-private payloads, or success claims.
3. Update the Phase 3 Markdown/HTML status to: local synthetic foundation QA-passed; external entry gates not authorized. Do not mark Phase 3 or M3 accepted.
4. Update `docs/architecture.md`, `docs/data-flow.md`, `docs/threat-model.md`, `docs/acp-compatibility.md`, and `docs/phase-0-environment-inventory.md` to distinguish fresh candidate evidence from historical account/deployment observations and proposed target topology.
5. Add non-secret evidence templates for: owner approval/test budget, account/environment identity, API/version pin, credential custody confirmation, callback registration, hosted DB/runtime, runner durability, one-payment result, redacted provider references, and rollback. Templates must use placeholders only.
6. Add a criterion-to-command/evidence index for E01–E09, X01–X11, and applicable PRD A-checks; no provider command should be executable by ordinary CI.
7. Run docs generation/validation, secret-pattern scans, link checks, and independent documentary review. Do not install dependencies or bypass the ecosyste.ms threat-intelligence timeout.

Exact blockers requiring approval or external capability

1. Written owner/Product approval for one bounded external spike, exact Stripe sandbox/profile, exact isolated staged environment, maximum USD test amount/count, test budget, and permitted mutations.
2. Secure rotation of the previously exposed standard Stripe test secret by the owner; replacement custody outside Git/chat/model context; credential-use approval immediately before the call.
3. Authenticated Stripe capability test establishing SPT/delegate-payment entitlement or a documented unsupported result; no fabricated token or substituted PaymentMethod.
4. Formal ADR-0003 decision and reviewer acceptance based on the authenticated result.
5. Approved stable HTTPS callback deployment mapped to the exact source commit, webhook destination registration, event allowlist, endpoint-specific signing-secret storage, and provider-signed retry evidence.
6. Approved hosted PostgreSQL provider/region/plan/cost, resource creation, concrete pg-compatible driver, pooled/direct connections, migration, backup/restore, retention, operator access, RPO/RTO, and cleanup ownership.
7. Resolution of the package threat-intelligence metadata timeout before adding/installing the runtime database dependency; no bypass or partial manifest change.
8. Approved durable runner/worker selection, hosted activation, retention/limits/cost, browser/process/deployment-loss recovery, observability, and version behavior.
9. Exact deployment approval and read-back of source commit/build/environment provenance.
10. Explicit authorization immediately before one fictional USD 1.00 automatic-capture test and any uncertain-response test; payment count/amount must remain bounded and no live-mode object may be accepted.
11. Tab QA of the exact deployed candidate, then Product acceptance. Push/PR/merge/production promotion remain separately approval-gated.

Recommended next bounded work package

Work package: `M3-GATE-DOC-001 — external-gate evidence packet`

- Base: exact QA-passed candidate `b9a480c353a7123c4680aec3ed5b442c8ceaa821`.
- Recommended isolated branch/worktree if authorized: `docs/m3-external-gate-packet` at `/Users/pradeepnair/Documents/GitHub/PRADPAY-m3-gate-docs`.
- Owner: Emily; Pete/Product reviews gate wording; Pixel reviews only user-facing labels; Dan is not required unless Product requests instrumentation criteria.
- Scope: documentation and non-executable evidence templates only.
- Proposed owned paths:
  - `docs/m3-entry-exit-gate-matrix.md`
  - `docs/decisions/0003-stripe-payment-path.md`
  - `docs/phases/phase-3-stripe-sale-and-recovery.md` and generated HTML
  - bounded updates to `docs/architecture.md`, `docs/data-flow.md`, `docs/threat-model.md`, `docs/acp-compatibility.md`, `docs/phase-0-environment-inventory.md`
  - new `docs/m3-external-evidence-template.md`
  - new `docs/m3-acceptance-traceability.md`
- Must not modify application code, migrations, manifests, lockfiles, credentials, environment values, provider resources, hosted resources, deployment config, or payment flags.
- Acceptance:
  1. Every E01–E09/X01–X11 row has status, evidence path, missing proof, next owner, and approval boundary.
  2. ADR-0003 remains proposed/blocked until authenticated evidence exists.
  3. Historical account/deployment observations are explicitly labeled historical and are not represented as current candidate evidence.
  4. All secret/account fields are placeholders; secret scan has no application/document credential finding.
  5. Phase 3 says local synthetic foundation QA-passed but external entry and full acceptance remain blocked.
  6. `npm run docs:phases:check`, link validation, `git diff --check`, and independent documentary review pass.
  7. Exact QA candidate `b9a480c` remains separately identifiable; no release/provider/payment claim is introduced.
- Rollback: revert only the documentation packet commit; candidate `b9a480c` remains the QA-passed code baseline.

Recommendation

Proceed next with `M3-GATE-DOC-001`. It reduces ambiguity and prepares a safe approval packet without spending, credentials, provider calls, hosted mutations, deployment, or payment. After Product/owner accepts that packet, the first external work should be a separately authorized capability/environment spike—not implementation-by-inference. Until then, keep payment handlers empty, complete/delegate-payment blocked, admission default-closed, and replay-only rollback available.
