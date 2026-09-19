# ADR-0004: Persisted outbox with a DurableWorkflowRunner port

- Status: accepted for local M2 fallback; hosted runner unselected
- Date: 2026-09-18
- Owner/reviewer: Emily / M2 integration review pending
- Scope: local and deterministic only

## Context

The agent flow must pause for human approval and provider authentication, resume after callbacks, retry safe steps, survive process loss, and continue reconciliation with every browser closed. M2 does not authorize Vercel Workflow activation, a hosted queue, credentials, deployment, provider calls, long timers, or an unattended worker. PostgreSQL remains business truth.

The earlier proposal selected Vercel Workflow subject to a deployed durability spike. That spike cannot be executed inside the approved M2 boundary, so dashboard availability and public limits are not treated as activation or durability evidence.

## Decision

Select a persisted transactional outbox as the M2 fallback. Consequential business mutation, domain event, and dedupe-keyed outbox job commit in one database transaction through the persistence port. A bounded dispatcher leases committed jobs with owner/token/expiry fencing, passes the dedupe key to an idempotent consumer, acknowledges only with the active fence, and records bounded retry or terminal failure.

Define the `DurableWorkflowRunner` boundary with:

- `start({workflowId, runId, definition, definitionVersion, input})`
- `resume(workflowId, {token})`
- `waitOrHook(workflowId, wait)`
- `retry(workflowId)`
- `wakeCallback(workflowId, {hook, callbackId, payload})`
- `cancel(workflowId, {reasonCode})`
- `status(workflowId)`

`lib/workflows/deterministic-runner.mjs` is a deterministic local fake of that boundary. It has no timers, background execution, provider dependency, or external calls. Its in-memory state is test evidence only and is never business truth. Production durability comes from the persisted business state and outbox; a future approved runner adapter must reconstruct/resume from those records.

## Local spike evidence

Focused tests demonstrate:

- atomic business/event/outbox commit and rollback on outbox failure;
- recovery after a synthetic crash/ack loss with repeated delivery but one dedupe-keyed business effect;
- active-lease exclusion, expired-lease takeover, and stale-fence rejection;
- deterministic bounded backoff and terminal failure telemetry;
- approval hook wait, callback wake, callback dedupe, explicit wait/resume, safe retry, cancel, and status;
- explicit capability report: `durable: false`, `automaticTimers: false`, `backgroundExecution: false`, `externalCalls: false`.

This local fake does not prove browser-independent hosted execution, retention, platform crash recovery, deployment/version compatibility, operational dashboards, quotas, cost, or provider callback reachability.

## Version behavior

Every workflow start records a `definitionVersion`. The fake retains that version for status and replay. M2 does not migrate a suspended instance across versions. A future runner selection must prove compatible deployment behavior or supply an explicit version-pinned resume/migration policy before admission is enabled.

## Consequences

- Dispatch is at least once; exactly-once claims apply only to the business-effect layer through durable dedupe/idempotency.
- Worker delivery receives only `safePayload` plus the dedupe key. Error telemetry records codes, job correlation identifiers, and a dedupe-key digest—not raw dedupe keys, exception messages, or provider payloads.
- Retry defaults are bounded and caller-configurable: batch 10, lease 30 seconds, five attempts, exponential delay from 1 second capped at 60 seconds.
- Terminal jobs remain persisted for operator review/replay policy; the dispatcher never silently drops or replaces them.
- No runner or dispatcher starts automatically. Integration must invoke it through an approved scheduled/request boundary.
- Live admission remains off until a hosted durability spike and owner approval exist.

## Rollback and disable

Stop dispatcher invocation and new workflow admission. Preserve committed outbox jobs, receipts, unknown operations, and reconciliation records. Application rollback must remain compatible with persisted rows. Do not delete unresolved records to recover service.

## Revisit gate

A hosted runner may supersede the fake only after owner approval and evidence for project activation, isolated environment, durability across process/deployment loss, callback authentication, retry/timeout semantics, retention, limits, cost, observability, disable/rollback, and version compatibility. The persistence/outbox contract remains required regardless of runner selection.
