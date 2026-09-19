# Acceptance traceability

Status values: `planned`, `implemented`, `passed`, `blocked`, `deferred`.
Evidence links are added when tests exist; prose assertions are not test evidence.

| ID | Primary phase | Planned verification | Status | Evidence |
| --- | --- | --- | --- | --- |
| A01 Replay makes no live mutations | 1 | Browser + route-boundary integration | implemented; QA pending | `test/replay-isolation.test.mjs`; local route read-back |
| A02 Historical cursor has no future facts | 1 | Reducer unit + browser seek | implemented; QA pending | `test/replay.test.mjs`; manual seek read-back |
| A03 Both agents and actual test evidence | 3 | Agent integration + Stripe smoke | planned | — |
| A04 One confirmed order/sale; quote total | 3 | Concurrency integration + smoke | planned | — |
| A05 Same run across tabs/windows | 2 | Multi-context browser test | planned | — |
| A06 Refresh after submission, no extra payment | 3 | Browser + provider integration | planned | — |
| A07 Above-authority quote blocked before PSP | 2 | Mandate integration | planned | — |
| A08 Cart change invalidates exact approval | 2 | Mandate/version integration | planned | — |
| A09 Expired/revoked pre-dispatch blocks PSP | 2 | State/integration | planned | — |
| A10 Post-dispatch revoke reconciles honestly | 3 | Provider integration + UI | planned | — |
| A11 Concurrent completion dispatches once | 3 | Database concurrency integration | planned | — |
| A12 Same-key retry stable; changed payload conflicts | 3 | Idempotency integration | planned | — |
| A13 Lost response reconciles original attempt | 3 | Fault-injection integration | planned | — |
| A14 Duplicate webhook has one effect | 3 | Webhook integration | planned | — |
| A15 Invalid webhook signature mutates nothing | 3 | Webhook security integration | planned | — |
| A16 Early/out-of-order webhook does not regress | 3 | Ordering integration | planned | — |
| A17 Redirect/model assertion cannot confirm order | 3 | Negative integration | planned | — |
| A18 Provider authentication persists/resumes | 3 | Hosted-flow integration or truthful capability check | planned | — |
| A19 Cross-session access denied without leakage | 2 | Authorization integration | planned | — |
| A20 Limit/kill switch rejects new work, reconciles old | 3 | Admission + recovery integration | planned | — |
| A21 Malicious text cannot change authority/tools | 2 | Agent adversarial test | planned | — |
| A22 Logs/exports/recordings contain no secrets | 4 | Automated secret scan + manual review | fixture check implemented; integrated path pending | `test/replay-isolation.test.mjs` |
| A23 ACP contracts match pinned schema | 2 | Generated-schema contract suite | scaffold implemented; endpoint suite pending | `test/acp-contract.test.mjs`; pinned upstream hashes |
| A24 Missing SPT uses accurate supported alternative | 0/3 | Capability spike + label browser test | planned | — |
| A25 Keyboard and reduced motion complete core flow | 1/4 | Accessibility browser + manual audit | semantic/local viewport review complete; QA audit pending | native controls; 390px local read-back |
| A26 Workflow survives all tabs closing | 2/3 | Durable runner integration | planned | — |
| A27 Commit-before-enqueue crash recovers | 2 | Outbox crash integration | planned | — |
| A28 Exact fixture economics | 1 | Money/quote unit test | implemented; QA pending | `test/domain-money.test.mjs` |

## Phase gate rule

A phase record lists the rows it advances. A row moves to `passed` only when its
repeatable test command, environment, safe result, and relevant artifact are
linked. A Phase 4 release review resolves every row. `Deferred` is acceptable
only when the behavior is outside the PRD's MVP and the UI makes no contrary
claim; a hard MVP invariant cannot be deferred to meet a date.
