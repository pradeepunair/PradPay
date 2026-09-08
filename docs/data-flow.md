# Data flows

Status: proposed from PRD version 1.0.

## Live purchase and evidence flow

```mermaid
sequenceDiagram
    actor V as Visitor
    participant UI as Browser UI
    participant API as Run API
    participant WF as Durable workflow
    participant BA as Buyer agent
    participant ACP as ACP merchant interface
    participant MA as Merchant services/agent
    participant G as Consent/payment gate
    participant DB as Postgres/outbox
    participant S as Stripe test API
    participant WH as Webhook intake

    V->>UI: Scenario and mission
    UI->>API: Create idempotent run
    API->>DB: Persist session/run/start event
    API->>WF: Dispatch committed work
    WF->>BA: Normalize and plan with bounded tools
    BA->>ACP: Create/read/update checkout
    ACP->>MA: Catalog, stock, offer, quote, reserve
    MA->>DB: Persist authoritative merchant facts/events
    WF-->>UI: Safe ordered projections
    UI->>V: Confirm requirements and show permission
    V->>UI: Grant exact/bounded authority
    UI->>API: Versioned mandate request
    API->>DB: Persist exact approved constraints
    WF->>G: Atomically validate and reserve authority
    G->>DB: Pre-create order/payment/attempt + dispatch record
    G->>S: Submit once with deterministic idempotency key
    S-->>G: Response, action required, or lost response
    G->>DB: Persist response or unknown state
    S->>WH: Signed test webhook
    WH->>DB: Verify, deduplicate, persist receipt
    WF->>DB: Apply/reconcile without state regression
    DB-->>UI: Snapshot + subsequent safe events
```

The database commit is the synchronization point. Browser displays, model text,
and success redirects are not payment evidence. Every mutating provider operation
has a stable internal operation ID, deterministic provider idempotency key,
request hash, and associated result.

## Unknown-outcome recovery

```mermaid
flowchart TD
    A["Provider submission recorded"] --> B{"Synchronous result received?"}
    B -- Yes --> C["Persist provider-native result"]
    B -- No / ambiguous --> U["Persist attempt = unknown"]
    C --> W["Await verified webhook or lookup"]
    U --> K{"Known provider reference?"}
    K -- Yes --> L["Retrieve current provider state"]
    K -- No --> R["Safe same-operation retry with same key and payload"]
    R --> C
    L --> C
    W --> D{"Trusted final evidence?"}
    D -- No --> W
    D -- Success --> E["Confirm order and consume mandate"]
    D -- Definitive failure --> F["Fail attempt; release only under valid rules"]
```

An HTTP timeout, browser refresh, tab closure, or worker lease expiry never
creates a new attempt or releases a reserved mandate while the outcome is
unknown.

## Webhook path

1. Receive the raw request at a stable public endpoint.
2. Verify the endpoint-specific signature and tolerance before trusted parsing.
3. Persist the provider event ID and minimized payload transactionally.
4. Return failure if durable receipt fails so Stripe can retry.
5. Enqueue/apply asynchronously and idempotently.
6. Match pre-created attempt/payment records using trusted provider metadata.
7. Ignore duplicate business effects; do not regress terminal state on
   out-of-order events.
8. Project a redacted evidence event for authorized viewers.

## Guided Replay data flow

```mermaid
flowchart LR
    Capture["Integrated test run"] --> Sanitize["Allowlist and pseudonymize"]
    Sanitize --> Validate["Schema, secret, and compatibility checks"]
    Validate --> Recording["Versioned immutable recording"]
    Recording --> ReadOnly["Public read-only replay route"]
    ReadOnly --> Reducer["Deterministic reducer at selected cursor"]
    Reducer --> Views["Buyer / Merchant / PSP / All Views"]
```

Before integrated recordings exist, fixtures follow the same schema but carry a
`synthetic_development_fixture` source label. Replay infrastructure has no
credentials or dependency on the live agent/payment mutation path.

## Data classification and projection

| Class | Examples | Storage/display rule |
| --- | --- | --- |
| Public replay | Fictional products, sanitized event summaries, safe pseudonyms | Versioned immutable asset after publication validation |
| Session-scoped | Mission, normalized constraints, run events, safe provider refs | Authorized session only; expire live detail by policy |
| Merchant-private | Cost, margin, offer/risk-rule inputs | Merchant agent/tools and authorized human observer projection only |
| Provider-sensitive | Client secret, raw credential/token, full provider payload | Minimize; trusted backend only; never event stream or model |
| Secret | API keys, webhook secrets, bearer credentials, session secret | Secret store only; never logs, docs, recordings, or database plaintext |
| Operational audit | Idempotency key association, request hash, webhook ID, reconciliation state | Restricted diagnostics; retain minimally until outcome resolved |

## Retention and deletion

Live run detail and transcripts expire after the configured default period
(proposed seven days). Sanitized recordings are separately reviewed durable
assets. Deletion cannot orphan a submitted or unknown payment: retain the minimum
attempt, provider reference, mandate reservation, webhook, and reconciliation
state until resolved. Provider-side test records follow provider retention and
are not erased by local cleanup.
