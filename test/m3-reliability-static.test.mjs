import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("synthetic provider has no imports, network primitives, provider SDK, timers, or process spawning", async () => {
  const text = await source("lib/payments/synthetic-provider.mjs");
  assert.doesNotMatch(text, /^\s*import\s/m);
  assert.doesNotMatch(text, /\b(fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval)\b/);
  assert.doesNotMatch(text, /\b(http|https|net|tls|dgram|undici|stripe|child_process|worker_threads)\b/i);
});

test("safety controller and facade have no network, provider, timer, or process capability", async () => {
  const text = `${await source("lib/safety/local-controller.mjs")}\n${await source("lib/safety/persistence.mjs")}`;
  assert.doesNotMatch(text, /\b(fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval|child_process|worker_threads)\b/);
  assert.doesNotMatch(text, /new\s+Stripe|paymentIntents|charges\.|refunds\.|\.confirm\(|\.capture\(/);
});

test("local composition imports only the accepted local persistence and reliability factories", async () => {
  const text = await source("lib/composition/local-webhook.mjs");
  const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, [
    "../../app/api/webhooks/stripe/route.js",
    "../payments/stripe-webhook-receipts.mjs",
    "../persistence/postgres.mjs",
    "../persistence/reliability-adapter.mjs",
    "../stripe-webhook.mjs",
  ].sort());
  assert.doesNotMatch(text, /\b(fetch|XMLHttpRequest|WebSocket|setTimeout|setInterval|child_process|worker_threads)\b/);
  assert.doesNotMatch(text, /new\s+Stripe|paymentIntents|charges\.|refunds\.|\.confirm\(|\.capture\(/);
});

test("verification boundary uses only the Stripe static webhook utility and exposes no mutation method", async () => {
  const text = await source("lib/stripe-webhook.mjs");
  assert.match(text, /Stripe\.webhooks/);
  assert.doesNotMatch(text, /new\s+Stripe|paymentIntents|charges\.|refunds\.|\.confirm\(|\.capture\(|fetch\(/);
});
