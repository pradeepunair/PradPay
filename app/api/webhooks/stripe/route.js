import { createStripeWebhookPost } from "../../../../lib/payments/stripe-webhook-route.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately unavailable until durable persistence is composed.
export const POST = createStripeWebhookPost({
  receiptService: null,
  endpointSecret: () => process.env.STRIPE_WEBHOOK_SECRET,
});
