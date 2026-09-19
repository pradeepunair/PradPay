# M2 ACP runtime feature flags

All values are server-only environment settings. None may use a `NEXT_PUBLIC_`
prefix or be exposed to browser code. A value enables a flag only when it is the
exact lowercase string `true`; missing values and every other value are false.

| Setting | Default | M2 behavior |
| --- | --- | --- |
| `ACP_RUNTIME_ADMISSION_ENABLED` | false | Gates create/retrieve/update/cancel after version, origin, bearer, and run-scope checks |
| `ACP_COMPLETE_ENABLED` | false | Reserved for a later milestone; complete remains unconditionally capability-blocked in M2 |
| `ACP_DELEGATE_PAYMENT_ENABLED` | false | Reserved for a later milestone; delegate-payment remains unconditionally capability-blocked in M2 |
| `ACP_ALLOWED_ORIGINS` | empty | Comma-separated canonical HTTP(S) origins allowed for browser requests; invalid and opaque origins are ignored, and empty rejects every supplied `Origin` |

The route boundary also requires these server-held authentication settings:

| Setting | Purpose |
| --- | --- |
| `ACP_RUNTIME_BEARER_TOKEN` | Bearer credential compared in constant time; never returned or logged |
| `ACP_RUNTIME_SUBJECT` | Authenticated service subject passed to the application port |
| `ACP_RUNTIME_SESSION_ID` | Only authorized session ID |
| `ACP_RUNTIME_RUN_IDS` | Comma-separated authorized run IDs |

Admission alone does not provide a repository. Emily's integration must inject an
application port with `configureAcpRuntimePort(port)`. Without a port, enabled
non-payment operations fail closed with `service_unavailable`.

With admission enabled, complete and delegate-payment requests still pass safe
header, scope, idempotency, body-size, JSON, and pinned-schema validation before
returning `capability_blocked`. They never invoke the corresponding application
port method, even if either reserved payment flag is `true`. Inbound
`Request-Id` values never replace the server-generated response request ID.

Rollback is to unset or set `ACP_RUNTIME_ADMISSION_ENABLED=false`. That stops new
ACP checkout admission without changing persisted records. The complete and
delegate-payment routes require a future reviewed code change, not merely a flag
change, before they can invoke any application/provider behavior.
