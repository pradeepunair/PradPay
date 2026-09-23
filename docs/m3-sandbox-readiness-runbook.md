# M3 local sandbox readiness runbook

Package: `M3-SANDBOX-READINESS-001`
Base: accepted QA baseline `b9a480c353a7123c4680aec3ed5b442c8ceaa821`.

## Scope and safety boundary

This package advances local synthetic readiness only. It does not connect to a
provider, retrieve credentials, register webhooks, deploy, mutate hosted resources,
create or process payments, or change remote Git state. Run the smoke using only the
explicit `PAYMENTLAB_*` settings listed below; do not pass the whole process
environment to application code. No secret values are accepted by this schema.

Provider credential and action windows apply only at a future externally approved
dispatch. They do not block local development or this fake-only smoke.

## Configuration contract

Schema: `config/m3-sandbox-readiness.schema.json`.

Required explicit settings:

- `PAYMENTLAB_ENVIRONMENT`: `local` or `staging`
- `PAYMENTLAB_DATABASE_MODE`: `local` or `hosted`
- `PAYMENTLAB_CALLBACK_MODE`: `disabled`, `local-synthetic`, or `hosted`
- `PAYMENTLAB_WORKER_MODE`: `disabled`, `local-synthetic`, or `hosted`

For `local`, database must be local and callback/worker may only be disabled or
synthetic. For `staging`, all three prerequisites must be declared hosted. Missing,
empty, unknown, mixed, or malformed configuration fails closed. The validator
accepts a small explicitly constructed settings object, rejects secret/provider
key names in that object, and emits fixed error codes without values.

## Fake-only smoke

From repository root:

    PAYMENTLAB_ENVIRONMENT=local PAYMENTLAB_DATABASE_MODE=local PAYMENTLAB_CALLBACK_MODE=local-synthetic PAYMENTLAB_WORKER_MODE=local-synthetic node scripts/m3-sandbox-smoke.mjs

The command executes the existing in-memory synthetic provider with a fixed
synthetic identity, replays the same identity, and checks for one deterministic
effect, two fake-adapter invocations, and no external provider or payment call.
It prints only a safe summary. No test uses network or credentials.

Expected local result fields:

- status `PASS`
- synthetic effects `1`
- fake provider calls `2`
- external provider calls `0`
- payments `0`
- replay verified `true`

Missing/invalid configuration exits nonzero with a fixed error code and does not
invoke the fake provider. Hosted mode remains `BLOCKED` until each prerequisite is
explicitly verified; this package does not claim hosted readiness.

## Staging prerequisite checklist (evidence required, not performed here)

Database:

- Approved isolated staging PostgreSQL endpoint and owner recorded.
- Network/TLS and least-privilege application role verified outside this local
  package; never store or print URL/password.
- Migration apply/rollback plan and backup/restore expectations reviewed.
- Schema/version and connection health read back in staging.

Callback/webhook:

- Product/security approval and exact endpoint/owner established.
- Provider destination registration remains a separate approved external action.
- Signature verification, event allowlist, replay/idempotency and safe redaction
  demonstrated with local synthetic fixtures before any external destination.
- No production endpoint or secret may be used for this readiness check.

Worker:

- Isolated staging worker identity, queue/outbox scope, lease, concurrency limit,
  retry budget, dead-letter behavior and kill switch approved.
- Start/stop, health, lag and terminal-failure signals recorded.
- No live payment/provider work is enabled by this package.

## Evidence and disposition

Record only commit, schema/config version, exact non-secret mode values, command,
exit code, safe result counts, and owner of each blocked prerequisite. Do not record
credentials, connection strings, tokens, webhook secrets, raw payloads, or complete
provider responses.

A local smoke PASS is not staging-ready, provider-ready, QA-approved, or release-
ready. Hosted prerequisites remain blocked until independently evidenced and
reviewed. Payment admission and complete/delegate-payment remain governed by the
accepted M3 hard blocks.
