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
| Existing projects | Only `pradeepunair-me` | `vercel project ls --scope prad7` |
| PaymentLab project | Does not exist | CLI project listing |
| Workflow | Dashboard available and shows Workflow SDK onboarding | Authenticated dashboard |
| Published Hobby Workflow allowance | 50,000 workflow events/month and 1 GB workflow storage writes; no Hobby on-demand overage | Current Vercel pricing table |
| Database | No existing team database/store shown | Authenticated Storage dashboard |
| Postgres choices shown | Neon, Supabase, Prisma Postgres, Nile, AWS among Marketplace choices | Authenticated Storage dashboard |
| Database proposal | Neon Postgres through Marketplace with Prisma ORM; no resource created | Provider comparison and ADR-0007 |
| AI Gateway | Available but unconfigured; setup asks for API key and billing card | Authenticated AI Gateway dashboard |

Creating the PaymentLab project, database, AI key, billing setup, domain, or
deployment would change external state and has not been done.

Vercel states that Hobby teams can be paused when included usage is exhausted.
That platform behavior is not sufficient as PaymentLab's product kill switch;
the application must stop new live work before the platform limit while keeping
submitted-payment reconciliation available.

## Stripe

| Fact | Verified value | Method |
| --- | --- | --- |
| Stripe CLI | Not installed | Local command inventory |
| Dashboard session | Not authenticated; currently at sign-in | Browser verification |
| ACP/SPT product status | Stripe documentation labels agentic commerce and SPT as private preview | Official Stripe documentation |
| Documented test path | Test helper can simulate a granted SPT, then confirm a PaymentIntent with that SPT | Official Stripe SPT documentation |
| Owner-account SPT availability | Unknown | Requires owner login and account-level test |

No test object, webhook endpoint, payment, API key, or account setting has been
created or changed.

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

1. Sign in to the intended Stripe test/sandbox account and verify SPT test-helper
   access without exposing keys.
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
