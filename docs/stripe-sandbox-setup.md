# Stripe sandbox credential setup

Use only credentials from the isolated **PradPay sandbox**. Do not paste any
credential into chat, Git, an issue, or a committed file. Stripe sandbox keys
start with `pk_test_`, `rk_test_`, or `sk_test_`; a webhook signing secret is a
separate, endpoint-specific value.

## Current status

- The application is deployed in Vercel project [`prad7/pradpay`](https://vercel.com/prad7/pradpay).
- The public receiver is `https://pradpay.vercel.app/api/webhooks/stripe`.
- The receiver fails closed with `503` while `STRIPE_WEBHOOK_SECRET` is absent.
- No Stripe event destination or test payment has been created.
- Current application code consumes only `STRIPE_WEBHOOK_SECRET`. The other two
  names reserve the configuration contract for the later Stripe payment flow.

## Where to enter credentials

Open the Vercel project, then go to **Settings → Environment Variables**. Add
only the values needed for the environment being tested.

| Variable | Stripe value | Exposure | Initial Vercel scope |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Sandbox publishable key | Browser-safe by design | Development and Preview, when the client flow exists |
| `STRIPE_SECRET_KEY` | Sandbox server API key | Server only | Development and Preview, when the payment spike is approved |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this exact webhook endpoint | Server only | The environment whose callback URL was registered |

Do not enable the publishable or API key in Production until the Phase 0
compatibility and recovery gates pass and that change is explicitly approved.
If the stable production callback above is registered in Stripe, its signing
secret must be scoped to Vercel Production; a Preview callback has a different
URL and must use its own endpoint-specific signing secret. Redeploy after
changing a Vercel environment variable because existing deployments do not
receive new values automatically.

Only `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` may be referenced from browser code.
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must remain in server code.

## Webhook sequence

1. Rotate any previously exposed Stripe sandbox API key before use.
2. Choose the exact deployed callback environment and URL.
3. In the PradPay sandbox, create the event destination for that URL only after
   reviewing the documented event-compatibility blocker in
   [`phase-0-environment-inventory.md`](phase-0-environment-inventory.md).
4. Copy that endpoint's signing secret directly into the matching Vercel
   environment as `STRIPE_WEBHOOK_SECRET`.
5. Redeploy that environment.
6. Run the signed-webhook smoke test before any approved test payment.

Do not reuse a webhook signing secret from another endpoint or environment.

## Optional local development

Create an ignored `.env.local` at the repository root:

```dotenv
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<PradPay sandbox publishable key>
STRIPE_SECRET_KEY=<PradPay sandbox server API key>
STRIPE_WEBHOOK_SECRET=<secret for the local Stripe CLI or registered endpoint>
```

`.env.example` contains names and descriptions only and must never contain real
values.

## References

- [Stripe API keys](https://docs.stripe.com/keys)
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
