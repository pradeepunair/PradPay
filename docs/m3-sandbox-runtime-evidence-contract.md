# M3 sandbox runtime-evidence contract

Package: `M3-SANDBOX-RUNTIME-EVIDENCE-001`
Base: QA-passed local-readiness commit `a0914d661968e44cfe18c1c5f4077fd6504adb08`.

## Scope

This package defines the data contract for a future isolated staging readiness record and a safe aggregate observation. It adds no server route, runtime probe, deployment adapter, hosted connection, callback delivery, queue consumer, credential access, provider call, webhook registration, payment behavior, or automatic retry. A `READY` record means only that the caller supplied every check as `ready`; it does not prove that an external system was contacted or verified. Local-only consumers must label their check inputs accurately.

## Contract

`lib/sandbox/runtime-evidence.mjs` requires:

- full 40-character lowercase candidate commit;
- environment label `local` or `staging`;
- fixed UTC timestamp in millisecond ISO format;
- exactly six checks: build, database, callback, worker, migration, and kill switch;
- each check status must be `ready`, `blocked`, or `unknown`;
- optional reason must be a fixed uppercase identifier, never free-form provider, endpoint, SQL, payload, or error text.

Missing, malformed, extra, or unsafe fields fail closed with a fixed error. Any blocked or unknown check makes the evidence `BLOCKED`. Evidence and nested checks are immutable. `summarizeRuntimeEvidence` emits only a fixed event name, status, environment, commit, and aggregate check counts; it excludes individual reasons and any free-form data.

## Local verification

From repository root:

    node --test test/m3-sandbox-runtime-evidence.test.mjs
    npm run sandbox:smoke
    npm run docs:phases:check

The runtime-evidence tests use literal local fixtures only. They do not probe database, callback, worker, network, or deployment resources. Do not create a staging record by marking unverified checks `ready`.

## Later staged evidence workflow (not performed here)

A later approved run must:

1. Pin the exact integrated candidate commit and immutable build artifact digest.
2. Identify the isolated staging environment and non-secret environment label without recording connection strings or endpoint secrets.
3. Have each accountable owner independently verify the relevant resource and record only status, timestamp, evidence reference, and fixed safe reason code.
4. Mark missing, stale, ambiguous, failed, or unowned evidence `unknown` or `blocked`; never infer success or auto-retry a destructive action.
5. Review the complete evidence record before changing staging admission. Keep rollback/stop conditions explicit and preserve payment admission hard blocks.

This contract alone cannot establish freshness policy, verify signatures, prove a migration rollback, guarantee worker liveness, or authorize deployment. Those controls require a separately reviewed runtime adapter and an approved environment-specific plan.

## Later owner approvals required

Before any hosted/staging work, collect exact, recorded approvals and ownership for:

- Product owner: acceptance criteria, staging scope, and candidate version.
- Security/credential owner: secret-store policy, least privilege, retention, and redaction; no secrets in evidence.
- Infrastructure/runtime owner: isolated staging target, deployment provenance, health/rollback plan, and stop authority.
- Database owner: isolated DB identity, migration/backup/restore and rollback evidence.
- Callback/webhook owner and Product/security: exact callback contract, verification, destination registration approval, and replay controls.
- Worker/reliability owner: queue/outbox scope, concurrency/lease/retry limits, kill switch, and stop procedure.
- QA owner: exact deployed build and environment read-back, test-data safety, defect disposition, and evidence report.
- Release authority: explicit staging/release gate approval as applicable.

No approval is requested or inferred by this local package. Production, external publication, protected-branch merge, live provider action, and payment require their own separate approval gates.
