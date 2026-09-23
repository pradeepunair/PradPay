import assert from "node:assert/strict";
import test from "node:test";

import {
  assessSandboxReadiness,
  parseSandboxConfiguration,
  REQUIRED_SANDBOX_SETTINGS,
  SandboxConfigurationError,
} from "../lib/sandbox/readiness.mjs";

const localConfig = Object.freeze({
  PAYMENTLAB_ENVIRONMENT: "local",
  PAYMENTLAB_DATABASE_MODE: "local",
  PAYMENTLAB_CALLBACK_MODE: "local-synthetic",
  PAYMENTLAB_WORKER_MODE: "local-synthetic",
});

const hostedConfig = Object.freeze({
  PAYMENTLAB_ENVIRONMENT: "staging",
  PAYMENTLAB_DATABASE_MODE: "hosted",
  PAYMENTLAB_CALLBACK_MODE: "hosted",
  PAYMENTLAB_WORKER_MODE: "hosted",
});

test("local config schema requires explicit local modes and is immutable", () => {
  const config = parseSandboxConfiguration(localConfig);
  assert.deepEqual(config, {
    environment: "local",
    databaseMode: "local",
    callbackMode: "local-synthetic",
    workerMode: "local-synthetic",
  });
  assert.equal(Object.isFrozen(config), true);
  assert.equal(REQUIRED_SANDBOX_SETTINGS.length, 4);
});

test("missing, empty, unknown and malformed values fail closed without value disclosure", () => {
  const cases = [
    {},
    { ...localConfig, PAYMENTLAB_WORKER_MODE: "" },
    { ...localConfig, PAYMENTLAB_DATABASE_MODE: "remote" },
    { ...localConfig, EXTRA_SETTING: "unexpected" },
    null,
    [],
  ];
  for (const candidate of cases) {
    assert.throws(() => parseSandboxConfiguration(candidate), (error) => {
      assert.equal(error instanceof SandboxConfigurationError, true);
      assert.doesNotMatch(error.message, /DATABASE_URL|secret|token|password/i);
      return true;
    });
  }
});

test("local mode rejects hosted components and staging requires all hosted prerequisites", () => {
  assert.throws(() => parseSandboxConfiguration({ ...localConfig, PAYMENTLAB_CALLBACK_MODE: "hosted" }), /invalid/i);
  assert.throws(() => parseSandboxConfiguration({ ...hostedConfig, PAYMENTLAB_WORKER_MODE: "disabled" }), /invalid/i);
});

test("provider, secret, credential, token and public-secret environment keys are rejected", () => {
  for (const key of ["STRIPE_SECRET_KEY", "PAYMENT_PROVIDER_TOKEN", "DB_PASSWORD", "API_CREDENTIAL", "NEXT_PUBLIC_STRIPE_SECRET"]) {
    assert.throws(() => parseSandboxConfiguration({ ...localConfig, [key]: "[REDACTED]" }), (error) => {
      assert.equal(error.code, "FORBIDDEN_SECRET_OR_PROVIDER_SETTING");
      assert.equal(error.message.includes("[REDACTED]"), false);
      return true;
    });
  }
});

test("local synthetic smoke can be READY while hosted prerequisites remain explicitly blocked", () => {
  const config = parseSandboxConfiguration(localConfig);
  assert.deepEqual(assessSandboxReadiness({ config, prerequisites: {} }), {
    status: "READY",
    checks: { database: true, callback: true, worker: true },
    reasons: [],
  });

  const staging = parseSandboxConfiguration(hostedConfig);
  const readiness = assessSandboxReadiness({
    config: staging,
    prerequisites: { database: "missing", callback: "missing", worker: "missing" },
  });
  assert.equal(readiness.status, "BLOCKED");
  assert.deepEqual(readiness.reasons, [
    "DATABASE_PREREQUISITE_NOT_READY",
    "CALLBACK_PREREQUISITE_NOT_READY",
    "WORKER_PREREQUISITE_NOT_READY",
  ]);
});

test("hosted staging readiness requires explicit affirmative prerequisites", () => {
  const config = parseSandboxConfiguration(hostedConfig);
  assert.equal(assessSandboxReadiness({
    config,
    prerequisites: { database: "ready", callback: "ready", worker: "ready" },
  }).status, "READY");
  for (const key of ["database", "callback", "worker"]) {
    assert.equal(assessSandboxReadiness({ config, prerequisites: { database: "ready", callback: "ready", worker: "ready", [key]: "unknown" } }).status, "BLOCKED");
  }
});
