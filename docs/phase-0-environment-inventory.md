# Phase 0 environment inventory

Verified: 2026-09-08. This file records identifiers and capabilities needed for
architecture decisions, never credentials or secret values.

## Implementation repository

| Fact | Verified value | Method |
| --- | --- | --- |
| Repository | `pradeepunair/PradPay` | Local remote and public GitHub repository |
| Default branch | `main` | Local remote reference |
| Active planning branch | `docs/mvp-implementation-plan` | Local Git status |
| Baseline content | PRD plus Phase 0/implementation documentation; no application scaffold | Repository tree |
| Repository instructions | No `AGENTS.md` present | Repository search |
| GitHub CLI | Installed, but saved GitHub authentication is invalid | `gh auth status` |

GitHub public reads work. Push/PR automation must be re-authenticated and tested
before relying on it; no login or credential change was attempted.

## Portfolio repository

| Fact | Verified value | Method |
| --- | --- | --- |
| Repository | `pradeepunair/website_files` | Local remote |
| Local/default state | Clean `main` matching `origin/main` at inspection | Git status/log |
| Application style | Separate Next.js static export with React, Tailwind, and MDX | `AGENTS.md`, `package.json` |
| Publication workflow | Branch → commit → push → PR → Vercel Preview review → merge | Repository `AGENTS.md` |
| Intended integration | Case-study/project link only; PaymentLab remains separately deployed | PRD plus repository rules |
| Version drift to resolve | `AGENTS.md` says Next.js 15; `package.json` specifies Next.js `^16.3.0` | Read-only comparison |

No portfolio file, deployment, or DNS record was changed. Its rules state that
DNS is owner-managed and direct production deployments are retired.

## Vercel

| Fact | Verified value | Method |
| --- | --- | --- |
| CLI | Vercel CLI 58.9.0 on Node.js 22.22.3 | Local CLI |
| Authenticated user | `pradeepunair-3058` | `vercel whoami` |
| Intended team | `prad7` / PRAD | CLI and dashboard |
| Team plan | Hobby | Authenticated dashboard |
| Existing projects | `pradeepunair-me` plus isolated `pradpay` | `vercel project ls --scope prad7` and deployment inspection |
| PaymentLab project | `prad7/pradpay`; production deployment ready | Vercel CLI project creation and deployment inspection |
| Public application URL | `https://pradpay.vercel.app` | HTTPS response `200` on 2026-09-09 |
| Public Stripe callback | `https://pradpay.vercel.app/api/webhooks/stripe` | HTTPS `POST` returns `503` fail-closed until `STRIPE_WEBHOOK_SECRET` exists |
| Workflow | Dashboard available and shows Workflow SDK onboarding | Authenticated dashboard |
| Published Hobby Workflow allowance | 50,000 workflow events/month and 1 GB workflow storage writes; no Hobby on-demand overage | Current Vercel pricing table |
| Database | No existing team database/store shown | Authenticated Storage dashboard |
| Postgres choices shown | Neon, Supabase, Prisma Postgres, Nile, AWS among Marketplace choices | Authenticated Storage dashboard |
| Database proposal | Neon Postgres through Marketplace with Prisma ORM; no resource created | Provider comparison and ADR-0007 |
| AI Gateway | Available but unconfigured; setup asks for API key and billing card | Authenticated AI Gateway dashboard |

The isolated PaymentLab project and first deployment were created with owner
authorization on 2026-09-09. No database, model key, billing setup, custom
domain, portfolio change, or Stripe configuration was created.

Vercel states that Hobby teams can be paused when included usage is exhausted.
That platform behavior is not sufficient as PaymentLab's product kill switch;
the application must stop new live work before the platform limit while keeping
submitted-payment reconciliation available.

## Stripe

| Fact | Verified value | Method |
| --- | --- | --- |
| Stripe CLI | Not installed | Local command inventory |
| Dashboard session | Authenticated to dedicated `PradPay sandbox`; sandbox banner visible | Browser verification |
| Current activity | No API requests, event deliveries, or payments shown | Dashboard and Workbench |
| API keys | Standard test keys exist; no restricted keys exist | Test-mode developer settings |
| Default API version | `2026-08-26.dahlia` | Workbench; do not change without a compatibility test |
| Event destinations | None configured | Workbench destinations |
| ACP/SPT product status | Stripe documentation labels agentic commerce and SPT as private preview | Official Stripe documentation |
| Documented test path | Test helper can simulate a granted SPT, then confirm a PaymentIntent with that SPT | Official Stripe SPT documentation |
| Owner-account SPT availability | Unknown | Requires a controlled test-helper call; dashboard access alone does not prove entitlement |

On 2026-09-09, the sandbox event-destination selector at API version
`2026-08-26.dahlia` exposed `shared_payment.granted_token.deactivated` but did
not expose or return a search result for the documented seller event
`shared_payment.granted_token.used`. The agent-side
`shared_payment.issued_token.used` event was available but was intentionally not
substituted. The prepared, unsubmitted destination therefore contains six
events: the five required PaymentIntent events plus granted-token deactivation.
This is account/UI capability evidence, not proof that the SPT API endpoint is
unavailable; the controlled test-helper call remains the deciding entitlement
check.

No test object, webhook endpoint, payment, API key, or account setting has been
created or changed.

### Credential safety finding

During read-only inspection, Stripe's API-key page exposed the existing standard
test secret through browser accessibility output without a reveal/copy action.
The value is not recorded in this repository and must not be reused. Rotate that
test secret before any PaymentLab API call, then store the replacement only in a
local secret store or an environment-scoped Vercel secret—not in chat, Git,
documentation, fixtures, logs, or model context.

### Stripe work required for the Phase 0 spike

1. Rotate the exposed standard test secret. Prefer a restricted key if Stripe
   exposes all SPT and PaymentIntent permissions required by the tested flow;
   otherwise use a newly rotated standard *test* secret in the isolated spike
   environment and rotate it again after the spike.
2. Pin the exact Stripe API version used by code and webhook events. Start by
   testing the account default `2026-08-26.dahlia`; do not silently inherit later
   account-version changes.
3. Deploy an isolated HTTPS callback at `/api/webhooks/stripe` before creating a
   dashboard event destination. Local development can use Stripe CLI after it is
   installed, but its signing secret is different from a dashboard endpoint.
4. Register only the required seller events: `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `payment_intent.processing`,
   `payment_intent.requires_action`, `payment_intent.canceled`,
   `shared_payment.granted_token.used`, and
   `shared_payment.granted_token.deactivated`.
5. Store the endpoint-specific signing secret outside Git and verify signatures
   against the untouched raw request body before parsing or acknowledging an event.
6. Call the documented SPT test helper with a fictional seller/cart reference,
   USD 1.00 maximum, short expiry, and a newly generated operation identity. A
   successful response proves account access; an authorization or unsupported-
   endpoint response is a documented private-preview blocker.
7. If the helper succeeds, create and confirm exactly one USD 1.00 automatic-
   capture PaymentIntent using the granted SPT, a deterministic idempotency key,
   safe metadata, and the same tested API version.
8. Prove signed receipt, duplicate delivery, out-of-order handling, and provider
   lookup/reconciliation while retaining only safe object identifiers and digests.

The fixed fictional spike identity is `phase0-spt-spike-001`, with seller/cart
reference `pradpay-phase0-cart-001`, amount USD 1.00 (`100` cents), and stable
PaymentIntent idempotency key `pradpay:phase0:spt-payment:v1`. Set the SPT expiry
to 15 minutes after the helper request. These values identify the one permitted
test attempt and contain no customer or payment credentials.

## ACP

| Fact | Verified value | Method |
| --- | --- | --- |
| Latest stable snapshot | `2026-04-17` | Official repository README/changelog |
| Previous PRD candidate | `2026-01-30`, now deprecated upstream | Official `2026-04-17` changelog |
| Pinned commit | `7fdd78df677a94dce04c770644b0fbbb1401272b` | Temporary shallow clone |
| Project maturity | Beta | Official repository README |
| License | Apache-2.0 with OpenAI and Stripe notice | `LICENSE` and `NOTICE` at pinned commit |
| Validation | Official comprehensive validation passed; all stable JSON Schemas compiled individually | Locked upstream tools in temporary checkout |

The exact hashes are in `protocol/acp/manifest.json`. Account-specific Stripe
handler/delegation support remains open and is not implied by schema validity.

## Local development tools and configuration

| Item | Verified state |
| --- | --- |
| Node.js | 22.22.3 |
| npm | 10.9.8 |
| Vercel CLI | Installed |
| GitHub CLI | Installed; authentication stale |
| Stripe CLI | Absent |
| `psql` | Absent |
| Relevant model/Stripe/database environment-variable names | None present in this task shell |

## Decisions blocked on owner or account evidence

1. Rotate the exposed Stripe test secret, store its replacement safely, and
   verify SPT test-helper access without exposing the replacement.
2. Decide whether Phase 0 may create a separate Vercel PaymentLab project and a
   small test database/workflow deployment.
3. Review the proposed Neon/Prisma choice and authorize resource creation only
   after plan, region, retention, branching, and cost review.
4. Select direct model-provider access versus Vercel AI Gateway; both require
   account and cost/data-policy verification.
5. Re-authenticate GitHub CLI before automated push/PR work.

## Authoritative external references

- [ACP official repository and stable snapshots](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe Shared Payment Tokens](https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens)
- [Stripe testing environments](https://docs.stripe.com/testing-use-cases)
- [Vercel pricing](https://vercel.com/pricing)
- [Vercel plan behavior](https://vercel.com/docs/plans)
- [Vercel Queues and Workflow relationship](https://vercel.com/docs/queues)
- [Postgres on Vercel Marketplace](https://vercel.com/docs/postgres)
- [Neon pricing and plan limits](https://neon.com/pricing)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
