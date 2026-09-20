import { createStripeWebhookPost } from "../../app/api/webhooks/stripe/route.js";
import { createStripeWebhookReceiptService } from "../payments/stripe-webhook-receipts.mjs";
import { createPostgresPersistence } from "../persistence/postgres.mjs";
import { createReliabilityPersistenceAdapter } from "../persistence/reliability-adapter.mjs";
import { verifyStripeEvent } from "../stripe-webhook.mjs";

const defaultAllowedTypes = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "payment_intent.canceled",
  "shared_payment.granted_token.used",
  "shared_payment.granted_token.deactivated",
]);

function opaqueProviderReference(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function expectedObjectType(eventType, objectType) {
  if (eventType.startsWith("payment_intent.")) return objectType === "payment_intent";
  if (eventType.startsWith("shared_payment.granted_token.")) {
    return objectType === "shared_payment" || objectType === "granted_token";
  }
  return true;
}

function verifyAllowlistedObject(args) {
  const event = verifyStripeEvent(args);
  const objectType = event?.data?.object?.object;
  if (defaultAllowedTypes.has(event.type) && !expectedObjectType(event.type, objectType)) {
    return { ...event, type: `local_ignored_object_type.${event.type}` };
  }
  return event;
}

export function createLocalWebhookComposition({
  pool,
  endpointSecret,
  applyBusinessEvent,
  allowedEventTypes = defaultAllowedTypes,
  isAllowedProviderReference = opaqueProviderReference,
  createId,
  now,
  toleranceSeconds,
}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("Local webhook composition requires an injected pg-compatible pool.");
  }
  if (typeof endpointSecret !== "string" || endpointSecret.length === 0) {
    throw new TypeError("Local webhook composition requires endpointSecret.");
  }
  if (typeof applyBusinessEvent !== "function") {
    throw new TypeError("Local webhook composition requires applyBusinessEvent().");
  }
  if (!(allowedEventTypes instanceof Set) || typeof isAllowedProviderReference !== "function") {
    throw new TypeError("Local webhook composition requires allowlist controls.");
  }

  const persistence = createPostgresPersistence(pool);
  const reliabilityPersistence = createReliabilityPersistenceAdapter(
    persistence,
    createId === undefined ? undefined : { createId },
  );
  const receiptService = createStripeWebhookReceiptService({
    persistence: reliabilityPersistence,
    verifyEvent: verifyAllowlistedObject,
    now,
    toleranceSeconds,
    async applyBusinessEvent(tx, safeEvent) {
      if (!allowedEventTypes.has(safeEvent.type)) return { disposition: "ignored_event_type" };
      if (!isAllowedProviderReference(safeEvent.objectId)) {
        return { disposition: "ignored_provider_reference" };
      }
      return applyBusinessEvent(tx, safeEvent);
    },
  });
  const post = createStripeWebhookPost({ receiptService, endpointSecret });

  return Object.freeze({ persistence, reliabilityPersistence, receiptService, post });
}
