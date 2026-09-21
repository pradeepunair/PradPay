# M3 acceptance traceability

Package: `M3-GATE-DOC-001`

Baseline: `b9a480c353a7123c4680aec3ed5b442c8ceaa821`

This index maps the M3.1 entry/exit gates and applicable PRD checks to current
local evidence and missing external proof. `LOCAL` never means provider, hosted,
deployed, Product-accepted, or release-ready. Ordinary CI must not use provider
credentials, register destinations, deploy, or create a payment.

## Gate index

| Gate set | Current disposition | Evidence | Required next proof |
| --- | --- | --- | --- |
| E01-E09 | E02 local; E01/E09 partial; E03-E08 blocked/partial | `docs/m3-entry-exit-gate-matrix.md`; `docs/m3-local-integration-evidence.md`; Tab report referenced by the matrix | Written authorization plus account, credential, callback, hosted DB/runner, deployment, and safety-default evidence |
| X01-X11 | Local invariants only; all externally unaccepted | `docs/m3-entry-exit-gate-matrix.md`; tests and runbooks named row by row | Exact deployed/provider evidence and Tab/Product acceptance after entry gates |

## Applicable PRD A-checks

| Check | Current M3 disposition | Repeatable local command/evidence | Missing external or acceptance proof |
| --- | --- | --- | --- |
| A04 One confirmed order/sale; quote total | BLOCKED externally | Local at-most-one and quote foundations: `test/m3-data-postgres.test.mjs`, `test/m3-reliability-safety-synthetic.test.mjs`, `test/domain-money.test.mjs` | Authorized Stripe test sale and confirmed order |
| A07 Above-authority quote blocked before PSP | PARTIAL local | `node --test test/m3-reliability-safety-synthetic.test.mjs`; zero synthetic-provider-call refusal cases | Deployed/provider boundary proof |
| A08 Cart change invalidates approval | PARTIAL local | `node --test test/m3-integration-contracts.test.mjs`; changed-hash conflicts | Exact deployed changed-cart proof before provider dispatch |
| A09 Expired/revoked pre-dispatch blocks PSP | PARTIAL local | Safety/attempt fencing in `test/m3-reliability-safety-synthetic.test.mjs` | Complete expired/revoked mandate cases and provider zero-call proof |
| A10 Post-dispatch revoke reconciles honestly | PARTIAL local | Admission-disabled reconciliation in `test/m3-reliability-safety-synthetic.test.mjs` | Provider-backed post-dispatch revoke/recovery proof |
| A11 Concurrent completion dispatches once | PARTIAL local | PostgreSQL concurrency/attempt constraints in `test/m3-data-postgres.test.mjs` | Concurrent deployed Stripe dispatch proof |
| A12 Same-key retry stable; changed payload conflicts | LOCAL | `node --test test/m3-integration-contracts.test.mjs`; repository and controller idempotency tests | Provider same-key behavior in approved environment |
| A13 Lost response reconciles original attempt | LOCAL synthetic / BLOCKED provider | Synthetic post-effect timeout and unknown-attempt tests in `test/m3-reliability-safety-synthetic.test.mjs` | Separately authorized real uncertain-response injection |
| A14 Duplicate webhook has one effect | LOCAL generated-signature | `node --test test/m3-reliability-webhook-composition.test.mjs` | Provider-signed duplicate delivery to registered endpoint |
| A15 Invalid webhook signature mutates nothing | LOCAL generated-signature | `node --test test/m3-reliability-webhook-composition.test.mjs` | Deployed endpoint and endpoint-specific secret evidence |
| A16 Early/out-of-order webhook does not regress | LOCAL generated-signature | `test/m3-reliability-webhook-composition.test.mjs` | Provider delivery/order evidence |
| A17 Redirect/model assertion cannot confirm order | PARTIAL local | ACP payment hard blocks and verified-evidence boundaries in `test/m2-acp-runtime.test.mjs` and M3 reliability tests | Deployed browser/provider negative test |
| A18 Provider authentication persists/resumes | BLOCKED | Synthetic `requires_action` behavior in `test/m3-reliability-safety-synthetic.test.mjs` | Account-supported auth flow or accepted unsupported label |
| A20 Limit/kill switch rejects new work, reconciles old | LOCAL | `node --test test/m3-reliability-safety-synthetic.test.mjs`; durable controls/reconciliation | Approved hosted defaults, alerts, and deployed recovery |
| A21 Malicious text cannot change authority/tools | PARTIAL local | Deterministic validated ports and authorization tests in the full `npm test` suite | Browser/adversarial acceptance evidence |
| A22 Logs/exports/recordings contain no secrets | PARTIAL local | Credential-pattern scans; safe projections; `test/replay-isolation.test.mjs` | Deployed logs/exports plus manual redaction review |
| A23 ACP contracts match pinned schema | LOCAL subset | `node --test test/acp-contract.test.mjs test/m3-acp-composition.test.mjs test/m3-integration-contracts.test.mjs` | Accepted payment-handler/API-version compatibility after capability spike |
| A24 Missing SPT uses accurate supported alternative | BLOCKED decision | `docs/acp-compatibility.md`; handlers empty and payment routes hard-blocked | Credentialed capability result and Product-approved label |
| A26 Workflow survives all tabs closing | PARTIAL local | Durable database/outbox interfaces and local recovery tests | Hosted runner plus browser/process/deployment-loss exercise |
| A27 Commit-before-enqueue crash recovers | LOCAL | Transactional outbox/crash tests in `test/m2-reliability-outbox-workflow.test.mjs` and M3 reconciliation tests | Hosted runner/deployment recovery proof |
| A28 Exact fixture economics | LOCAL | `node --test test/domain-money.test.mjs` | Re-run as part of exact deployed candidate suite; no provider action needed |

## Safe command boundary

The documented local commands run repository tests and documentation validation
only. Provider commands are deliberately omitted. The first credentialed action
is the separately authorized Stripe capability-spike call described in ADR-0003
and `docs/m3-external-evidence-template.md`; it must never run in ordinary CI.

A check moves to externally accepted only when the exact command/action,
environment, source/deployment identity, redacted result, approver, and review date
are linked. Prose, historical dashboard observations, and local synthetic results
are not substitutes for provider or hosted evidence.
