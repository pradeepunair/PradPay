# M3 external-evidence template

Status: placeholder only; no external evidence has been collected or accepted.

Use this template only after a separately approved external work package. Replace
bracketed fields with non-secret, redacted facts. Never include credentials,
reusable tokens, client secrets, webhook signing secrets, complete provider
payloads, customer data, or payment instrument data.

## Authorization record

- Work package: `[APPROVED_PACKAGE_ID]`
- Product approver and timestamp: `[NAME / ISO-8601]`
- Account/resource owner approver and timestamp: `[NAME / ISO-8601]`
- Exact allowed actions: `[BOUNDED_ACTIONS]`
- Explicitly prohibited actions: `[PROHIBITIONS]`
- Maximum payment count and amount: `[COUNT / TEST_CURRENCY_AMOUNT]`
- Approved start/stop window: `[ISO-8601 RANGE]`
- Operator and rollback owner: `[NAMES]`

## Candidate and environment identity

- Source commit: `[FULL_COMMIT_SHA]`
- Build/deployment ID: `[REDACTED_REFERENCE]`
- Environment name and owner: `[NAME / OWNER]`
- Read-back proving source-to-deployment mapping: `[REDACTED_REFERENCE]`
- Stripe account/sandbox label: `[NON_SECRET_LABEL]`
- Test/live assertion and evidence timestamp: `[TEST_MODE / ISO-8601]`
- Stripe API/version pin: `[VERSION]`

## Credential custody confirmation

- Previously exposed test secret rotated: `[YES / TIMESTAMP / OWNER]`
- Replacement location class: `[APPROVED_SECRET_STORE_CLASS]`
- Least-privilege scope reviewed: `[YES / REVIEWER]`
- Rotation/expiry owner: `[NAME]`
- Secret value recorded here: `NO — MUST REMAIN NO`

## Capability-spike evidence

This is the first step that requires Stripe credentials: an authenticated call to
the documented test helper in the approved sandbox to determine whether that
account supports SPT/delegate payment. It must occur before any payment test and
only after the authorization and custody sections above are complete.

- Exact documented capability question: `[QUESTION]`
- Pinned documentation/API reference: `[SAFE_URL_OR_VERSION]`
- Invocation timestamp and operator: `[ISO-8601 / NAME]`
- Result class: `[SUPPORTED / UNSUPPORTED / AMBIGUOUS]`
- Redacted request/response reference: `[REFERENCE]`
- No payment mutation occurred: `[YES / EVIDENCE]`
- Product disposition: `[REPLAY_ONLY / CUSTOM_PATH_REVIEW / SPT_PATH_REVIEW]`
- ADR-0003 reviewer/date: `[NAME / ISO-8601 / STILL_PROPOSED_OR_ACCEPTED]`

## Callback evidence (later package only)

- Stable HTTPS endpoint and deployment ID: `[SAFE_REFERENCE]`
- Destination registration ID: `[REDACTED_REFERENCE]`
- Allowed event types: `[ALLOWLIST]`
- Endpoint-specific secret custody confirmation: `[NO_VALUE / OWNER / STORE]`
- Provider-signed delivery and retry references: `[REDACTED_REFERENCES]`
- Receipt-before-ack, duplicate, invalid-signature, and ordering results: `[REFERENCES]`

## Hosted database and runtime evidence (later package only)

- Provider/region/plan and resource owner: `[VALUES]`
- Approved cost ceiling: `[VALUE]`
- Driver/pool versions and lockfile commit: `[VALUES]`
- Pooled/direct behavior: `[RESULT]`
- Migration/rollback result: `[REFERENCE]`
- Backup/restore rehearsal: `[REFERENCE]`
- Retention, access, RPO/RTO, and cleanup owner: `[VALUES]`
- Durable runner version, limits, retention, and cost: `[VALUES]`
- Browser/process/deployment-loss recovery evidence: `[REFERENCES]`
- Operator alerts/diagnostics evidence: `[REFERENCE]`

## One-payment evidence (later package only)

Do not complete this section until E03-E08 are accepted and an approver authorizes
the exact mutation immediately before it occurs.

- Immediate approval timestamp: `[ISO-8601]`
- Approved fictional test amount/count: `[CURRENCY_AMOUNT / COUNT]`
- Idempotency/request-hash references: `[REDACTED_REFERENCES]`
- Provider object mode: `[TEST]`
- Provider payment/order references: `[REDACTED_REFERENCES]`
- Callback/lookup confirmation source: `[REFERENCE]`
- At-most-one result: `[REFERENCE]`
- No real-money assertion: `[REFERENCE]`
- Uncertain-response result, if separately authorized: `[REFERENCE_OR_NOT_RUN]`

## Rollback and cleanup

- Admission disabled and in-flight work accounted for: `[RESULT]`
- Created test artifacts enumerated: `[SAFE_REFERENCES]`
- Cleanup/revocation/rotation performed: `[RESULT / OWNER / TIMESTAMP]`
- Reconciliation completed before teardown: `[RESULT]`
- Residual resources/cost/risk: `[NONE_OR_DETAILS]`
- Final Product/QA disposition: `[BLOCKED / PARTIAL / ACCEPTED]`
