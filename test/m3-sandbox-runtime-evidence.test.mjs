import assert from "node:assert/strict";
import test from "node:test";

import {
  createRuntimeEvidence,
  RuntimeEvidenceError,
  summarizeRuntimeEvidence,
} from "../lib/sandbox/runtime-evidence.mjs";

const allReady = Object.freeze(Object.fromEntries([
  "build", "database", "callback", "worker", "migration", "killSwitch",
].map((name) => [name, { status: "ready" }])));
const candidate = Object.freeze({
  commit: "a0914d661968e44cfe18c1c5f4077fd6504adb08",
  environment: "local",
  generatedAt: "2026-09-23T12:00:00.000Z",
  checks: allReady,
});

test("creates immutable ready evidence only from the exact complete check contract", () => {
  const evidence = createRuntimeEvidence(candidate);
  assert.equal(evidence.status, "READY");
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(Object.isFrozen(evidence.checks), true);
  assert.deepEqual(Object.keys(evidence.checks), ["build", "database", "callback", "worker", "migration", "killSwitch"]);
});

test("unknown, blocked, or unavailable dependencies fail closed without retry semantics", () => {
  for (const status of ["unknown", "blocked"]) {
    const evidence = createRuntimeEvidence({
      ...candidate,
      checks: { ...allReady, database: { status, reason: "PROBE_UNAVAILABLE" } },
    });
    assert.equal(evidence.status, "BLOCKED");
  }
  assert.throws(() => createRuntimeEvidence({ ...candidate, checks: { ...allReady, worker: undefined } }), RuntimeEvidenceError);
});

test("rejects invalid candidate identity, timestamps, status values, and check fields", () => {
  assert.throws(() => createRuntimeEvidence({ ...candidate, commit: "bad" }), RuntimeEvidenceError);
  assert.throws(() => createRuntimeEvidence({ ...candidate, generatedAt: "yesterday" }), RuntimeEvidenceError);
  assert.throws(() => createRuntimeEvidence({
    ...candidate,
    checks: { ...allReady, callback: { status: "ready", endpoint: "https://secret.invalid" } },
  }), RuntimeEvidenceError);
  assert.throws(() => createRuntimeEvidence({
    ...candidate,
    checks: { ...allReady, database: { status: "ready", reason: "postgres://user:pass@host/db" } },
  }), RuntimeEvidenceError);
  assert.throws(() => createRuntimeEvidence({
    ...candidate,
    checks: { ...allReady, worker: { status: "blocked", reason: "STRIPE_SECRET_KEY_SK_TEST_ABC123" } },
  }), RuntimeEvidenceError);
});

test("rejects inherited, extra, symbol, custom-prototype, and accessor check containers", () => {
  const inherited = Object.assign(Object.create({ extra: { status: "ready" } }), allReady);
  assert.throws(() => createRuntimeEvidence({ ...candidate, checks: inherited }), RuntimeEvidenceError);
  assert.throws(() => createRuntimeEvidence({ ...candidate, checks: { ...allReady, extra: { status: "ready" } } }), RuntimeEvidenceError);
  assert.throws(() => createRuntimeEvidence({ ...candidate, checks: Object.assign({ ...allReady }, { [Symbol("extra")]: true }) }), RuntimeEvidenceError);
  assert.throws(() => createRuntimeEvidence({ ...candidate, checks: new class extends Object { constructor() { super(); Object.assign(this, allReady); } }() }), RuntimeEvidenceError);
  const accessorCheck = { ...allReady };
  Object.defineProperty(accessorCheck, "database", { enumerable: true, get: () => ({ status: "ready" }) });
  assert.throws(() => createRuntimeEvidence({ ...candidate, checks: accessorCheck }), RuntimeEvidenceError);
});

test("safe operational summary contains only fixed labels, commit, and aggregate counts", () => {
  const evidence = createRuntimeEvidence({
    ...candidate,
    checks: { ...allReady, database: { status: "unknown", reason: "PROBE_UNAVAILABLE" } },
  });
  const summary = summarizeRuntimeEvidence(evidence);
  assert.deepEqual(summary, {
    event: "sandbox.runtime_readiness",
    status: "BLOCKED",
    environment: "local",
    commit: candidate.commit,
    checkCounts: { ready: 5, blocked: 0, unknown: 1 },
  });
  assert.equal(JSON.stringify(summary).includes("PROBE_UNAVAILABLE"), false);
  assert.throws(() => summarizeRuntimeEvidence({ ...evidence }), RuntimeEvidenceError);
  assert.throws(() => summarizeRuntimeEvidence(Object.freeze({
    schemaVersion: 1,
    status: "READY",
    environment: "staging",
    commit: "attacker-controlled",
    checks: {},
  })), RuntimeEvidenceError);
});

test("does not turn evidence shape into a hosted health probe", () => {
  const evidence = createRuntimeEvidence({ ...candidate, environment: "staging" });
  assert.equal(evidence.status, "READY");
  assert.equal(evidence.environment, "staging");
  assert.equal("endpoint" in evidence, false);
});
