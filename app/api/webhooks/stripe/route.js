import { createStripeWebhookPost } from "../../../../lib/payments/stripe-webhook-route.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The integration owner must compose the data-owned persistence adapter. Until
// that happens the exported route is deliberately unavailable rather than
// acknowledging an event without a durable receipt.
export const POST = createStripeWebhookPost({
  receiptService: null,
  endpointSecret: () => process.env.STRIPE_WEBHOOK_SECRET,
});
