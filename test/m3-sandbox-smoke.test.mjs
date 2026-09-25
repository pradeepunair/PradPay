import assert from "node:assert/strict";
import test from "node:test";

import { runSyntheticSandboxSmoke } from "../lib/sandbox/synthetic-smoke.mjs";

const localEnv = Object.freeze({
  PAYMENTLAB_ENVIRONMENT: "local",
  PAYMENTLAB_DATABASE_MODE: "local",
  PAYMENTLAB_CALLBACK_MODE: "local-synthetic",
  PAYMENTLAB_WORKER_MODE: "local-synthetic",
});

test("synthetic sandbox smoke replays one fake effect and calls no external provider", async () => {
  const result = await runSyntheticSandboxSmoke({ env: localEnv });
  assert.equal(result.status, "PASS");
  assert.equal(result.syntheticEffects, 1);
  assert.equal(result.providerCalls, 2);
  assert.equal(result.externalProviderCalls, 0);
  assert.equal(result.payments, 0);
  assert.equal(result.replayVerified, true);
});

test("smoke refuses staging/hosted modes and does not create fake or external effects", async () => {
  const result = await runSyntheticSandboxSmoke({
    env: {
      PAYMENTLAB_ENVIRONMENT: "staging",
      PAYMENTLAB_DATABASE_MODE: "hosted",
      PAYMENTLAB_CALLBACK_MODE: "hosted",
      PAYMENTLAB_WORKER_MODE: "hosted",
    },
    prerequisites: { database: "missing", callback: "missing", worker: "missing" },
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.syntheticEffects, 0);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.readiness.status, "BLOCKED");
});

test("smoke requires validated explicit local configuration", async () => {
  await assert.rejects(runSyntheticSandboxSmoke({ env: { PAYMENTLAB_ENVIRONMENT: "local" } }));
});
