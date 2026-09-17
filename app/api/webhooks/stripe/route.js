import {
  classifyStripeEvent,
  verifyStripeEvent,
} from "../../../../lib/stripe-webhook.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request) {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    return Response.json(
      { error: "Webhook endpoint is not configured." },
      { status: 503, headers: responseHeaders },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(
      { error: "Webhook signature is required." },
      { status: 400, headers: responseHeaders },
    );
  }

  const rawBody = await request.text();
  let event;
  try {
    event = verifyStripeEvent({ rawBody, signature, endpointSecret });
  } catch {
    return Response.json(
      { error: "Webhook signature verification failed." },
      { status: 400, headers: responseHeaders },
    );
  }

  const classification = classifyStripeEvent(event);
  if (!classification.accepted) {
    return Response.json(
      { error: "Live-mode Stripe events are not accepted." },
      { status: 400, headers: responseHeaders },
    );
  }

  return Response.json(
    { received: true, disposition: classification.disposition },
    { status: 200, headers: responseHeaders },
  );
}
