import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  OUTER_END_EPOCH,
  OUTER_START_EPOCH,
  assertExecutionEpoch,
  parseSntpSample,
} from "../lib/spike-guard/clock.mjs";
import {
  APPROVED_REQUEST_HASH,
  FROZEN_REQUEST_HASH,
  FROZEN_SPIKE_REQUEST,
  assertExactSpikeRequest,
  canonicalRequestHash,
} from "../lib/spike-guard/request.mjs";
import {
  APPROVED_APPROVAL_ID,
  CLOCK_AUTHORITY,
  createApprovalLease,
  createFilesystemOneShot,
} from "../lib/spike-guard/state.mjs";
import { CANONICAL_SPIKE_STATE_DIRECTORY, SPIKE_EXECUTION_DISABLED_MESSAGE, executeApprovedStripeCapabilitySpike } from "../lib/spike-guard/guard.mjs";
import { executeStripeSpikeGuardCore, projectProviderOutcome } from "../lib/spike-guard/guard-core.mjs";
import { createHostClockCapture } from "../lib/spike-guard/host-clock.mjs";
import { createStripeGrantedTokenTransport } from "../lib/spike-guard/stripe-transport.mjs";
import { sanitizeExecutionFailure, SAFE_EXECUTION_FAILURE_MESSAGE } from "../lib/spike-guard/safe-errors.mjs";

const EXECUTION_EPOCH = OUTER_START_EPOCH + 120;
const SNTP_OUTPUT = [
  "selected:",
  "sntp_exchange {",
  "        result: 0 (Success)",
  "        offset: FFFFFFFFFFFFFFFF.E000000000000000 (-0.125000)",
  "}",
  "-0.125000 +/- 0.010000 time.apple.com 17.253.20.45",
].join("\n");

function replaceOffset(output, value) {
  return output.replaceAll("-0.125000", value);
}

function sntp(overrides = {}) {
  return Object.freeze({
    command: Object.freeze(["sntp", "-d", "time.apple.com"]),
    output: SNTP_OUTPUT,
    exitCode: 0,
    observedAtEpoch: EXECUTION_EPOCH - 1,
    nowEpoch: EXECUTION_EPOCH,
    ...overrides,
  });
}

function clockCapture({
  epochs = [EXECUTION_EPOCH, EXECUTION_EPOCH, EXECUTION_EPOCH, EXECUTION_EPOCH],
  capturedAtMs = epochs.map((epoch) => epoch * 1000),
  evidence = {},
} = {}) {
  let index = 0;
  return async () => {
    const position = Math.min(index, epochs.length - 1);
    const epoch = epochs[position];
    const captureMs = capturedAtMs[Math.min(index, capturedAtMs.length - 1)];
    index += 1;
    const snapshotEvidence = sntp({ observedAtEpoch: epoch - 1, nowEpoch: epoch, ...evidence });
    return Object.freeze({ authority: CLOCK_AUTHORITY, epoch, capturedAtMs: captureMs, evidence: snapshotEvidence });
  };
}

function approval(overrides = {}) {
  return {
    approvalId: APPROVED_APPROVAL_ID,
    approvedAtEpoch: EXECUTION_EPOCH,
    durationSeconds: 600,
    clockAuthority: CLOCK_AUTHORITY,
    outerStartEpoch: OUTER_START_EPOCH,
    outerEndEpoch: OUTER_END_EPOCH,
    requestHash: FROZEN_REQUEST_HASH,
    ...overrides,
  };
}

async function tempState(t) {
  const directory = await mkdtemp(join(tmpdir(), "m3-stripe-spike-guard-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function cloneRequest(mutator = () => {}) {
  const request = structuredClone(FROZEN_SPIKE_REQUEST);
  mutator(request);
  return request;
}

function spies({ dispatchError } = {}) {
  const calls = { credential: 0, dispatch: 0 };
  return {
    calls,
    async credential() {
      calls.credential += 1;
      return Object.freeze({ kind: "injected-test-credential", account: FROZEN_SPIKE_REQUEST.account, livemode: false });
    },
    async dispatch(input) {
      await input.authorizeSend();
      if (input.signal.aborted) throw input.signal.reason;
      calls.dispatch += 1;
      assert.deepEqual(input.request, FROZEN_SPIKE_REQUEST);
      assert.equal(input.requestHash, FROZEN_REQUEST_HASH);
      assert.equal(input.credential.kind, "injected-test-credential");
      if (dispatchError) throw dispatchError;
      return Object.freeze({
        statusClass: "success",
        requestReference: `sha256:${"a".repeat(64)}`,
        objectClass: "granted_token",
        objectReference: `sha256:${"b".repeat(64)}`,
        hasError: false,
      });
    },
  };
}

test("clock parser accepts exactly one fresh successful selected time.apple.com sample", () => {
  const sample = parseSntpSample(sntp());
  assert.deepEqual(sample, {
    target: "time.apple.com",
    offsetSeconds: -0.125,
    uncertaintySeconds: 0.01,
    observedAtEpoch: EXECUTION_EPOCH - 1,
    nowEpoch: EXECUTION_EPOCH,
    ageSeconds: 1,
  });
  assert.equal(Object.isFrozen(sample), true);
});

test("clock parser rejects failed, missing, duplicate, malformed, wrong-target, stale, future, and excessive-offset samples", () => {
  const cases = [
    sntp({ exitCode: 1 }),
    sntp({ output: "sntp diagnostic only" }),
    sntp({ output: `${SNTP_OUTPUT}\n${SNTP_OUTPUT}` }),
    sntp({ output: SNTP_OUTPUT.replace("result: 0 (Success)", "result: malformed") }),
    sntp({ output: SNTP_OUTPUT.replace("(-0.125000)", "(not-a-number)") }),
    sntp({ output: SNTP_OUTPUT.replace("time.apple.com", "pool.ntp.org") }),
    sntp({ output: `${SNTP_OUTPUT}\n+0.125000 +/- 0.010000 pool.ntp.org 192.0.2.1` }),
    sntp({ command: Object.freeze(["sntp", "-d", "pool.ntp.org"]) }),
    sntp({ observedAtEpoch: EXECUTION_EPOCH - 61 }),
    sntp({ observedAtEpoch: EXECUTION_EPOCH + 1 }),
    sntp({ output: replaceOffset(SNTP_OUTPUT, "+1.000001") }),
  ];
  for (const candidate of cases) assert.throws(() => parseSntpSample(candidate));
});

test("clock parser accepts absolute offset boundary and sample-age boundaries", () => {
  assert.equal(parseSntpSample(sntp({ output: replaceOffset(SNTP_OUTPUT, "+1.000000") })).offsetSeconds, 1);
  assert.equal(parseSntpSample(sntp({ observedAtEpoch: EXECUTION_EPOCH })).ageSeconds, 0);
  assert.equal(parseSntpSample(sntp({ observedAtEpoch: EXECUTION_EPOCH - 60 })).ageSeconds, 60);
});

test("host clock adapter captures the approved command, immutable evidence, and host epoch in one operation", async () => {
  const times = [EXECUTION_EPOCH * 1000, EXECUTION_EPOCH * 1000];
  const capture = createHostClockCapture({
    run: async (command, args) => {
      assert.equal(command, "sntp");
      assert.deepEqual(args, ["-d", "time.apple.com"]);
      return { stdout: SNTP_OUTPUT, stderr: "" };
    },
    now: () => times.shift(),
  });
  const snapshot = await capture();
  assert.equal(snapshot.authority, CLOCK_AUTHORITY);
  assert.equal(snapshot.epoch, EXECUTION_EPOCH);
  assert.equal(snapshot.capturedAtMs, EXECUTION_EPOCH * 1000);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.evidence), true);
  assert.deepEqual(snapshot.evidence.command, ["sntp", "-d", "time.apple.com"]);
});

test("host clock adapter fails closed on command failure", async () => {
  const capture = createHostClockCapture({
    run: async () => { throw Object.assign(new Error("sntp failed"), { code: 1, stderr: "failure" }); },
    now: () => EXECUTION_EPOCH * 1000,
  });
  await assert.rejects(capture(), /did not succeed/);
});

test("outer window is start-inclusive and end-exclusive", () => {
  assert.equal(assertExecutionEpoch(OUTER_START_EPOCH), OUTER_START_EPOCH);
  assert.equal(assertExecutionEpoch(OUTER_END_EPOCH - 1), OUTER_END_EPOCH - 1);
  assert.throws(() => assertExecutionEpoch(OUTER_START_EPOCH - 1));
  assert.throws(() => assertExecutionEpoch(OUTER_END_EPOCH));
});

test("frozen request has stable canonical hash and immutable exact literals", () => {
  assert.equal(APPROVED_REQUEST_HASH, "9b65d45d89ce5ad18eb6f1da316b89cbaba2ae4ea14566dfc5a6b863022b0f9f");
  assert.equal(FROZEN_REQUEST_HASH, canonicalRequestHash(structuredClone(FROZEN_SPIKE_REQUEST)));
  assert.match(FROZEN_REQUEST_HASH, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(FROZEN_SPIKE_REQUEST), true);
  assert.equal(Object.isFrozen(FROZEN_SPIKE_REQUEST.body), true);
  assert.equal(Object.isFrozen(FROZEN_SPIKE_REQUEST.transport), true);
  assert.equal(assertExactSpikeRequest(structuredClone(FROZEN_SPIKE_REQUEST)), FROZEN_SPIKE_REQUEST);
});

test("request boundary rejects alternate account, profile, version, ACP, PM, SPT capability, input, and expiry", () => {
  const mutations = [
    (r) => { r.account = "acct_other"; },
    (r) => { r.profile = "Other sandbox"; },
    (r) => { r.stripeApiVersion = "2026-08-25"; },
    (r) => { r.acpVersion = "2026-04-16"; },
    (r) => { r.body.payment_method = "pm_other"; },
    (r) => { r.capability = "alternate_spt"; },
    (r) => { r.body.usage_limits.currency = "eur"; },
    (r) => { r.body.usage_limits.max_amount = 101; },
    (r) => { r.body.usage_limits.expires_at = OUTER_END_EPOCH - 1; },
    (r) => { r.path = "/v1/payment_intents"; },
    (r) => { r.method = "GET"; },
    (r) => { r.extra = true; },
  ];
  for (const mutate of mutations) assert.throws(() => assertExactSpikeRequest(cloneRequest(mutate)));
});

test("request boundary rejects retry, redirect, fallback, resubmit, multiple attempts, and any payment effect", () => {
  const mutations = [
    (r) => { r.transport.retry = true; },
    (r) => { r.transport.followRedirects = true; },
    (r) => { r.transport.fallback = true; },
    (r) => { r.transport.resubmit = true; },
    (r) => { r.transport.maxAttempts = 2; },
    (r) => { r.effects.paymentCount = 1; },
    (r) => { r.effects.usdAmount = 0.01; },
  ];
  for (const mutate of mutations) assert.throws(() => assertExactSpikeRequest(cloneRequest(mutate)));
});

test("production entry point is hard-disabled before inspecting approvals or callbacks", async () => {
  assert.match(CANONICAL_SPIKE_STATE_DIRECTORY, new RegExp(FROZEN_REQUEST_HASH));
  const cases = [
    undefined,
    null,
    { approval: undefined },
    { approval: "malformed" },
    { approval: { ...approval(), signature: "forged-untrusted-signature" } },
    { approval: { ...approval(), issuedAt: EXECUTION_EPOCH - 7200, expiresAt: EXECUTION_EPOCH - 1 } },
    { approval: { ...approval(), nonce: "already-consumed-nonce" } },
    { approval: { ...approval(), ownerIdentity: "wrong-owner" } },
    { approval: { ...approval(), candidateCommit: "0".repeat(40) } },
    { approval: { ...approval(), requestHash: "0".repeat(64) } },
    { approval: { ...approval(), account: "acct_wrong", profile: "wrong-profile" } },
    { approval: { ...approval(), operatorIdentity: "wrong-operator" } },
    { approval: { ...approval(), outerStartEpoch: OUTER_START_EPOCH + 1, outerEndEpoch: OUTER_END_EPOCH } },
    { approval: { ...approval(), actionScope: { requestCount: 2, paymentCount: 1, cleanup: "unbounded" } } },
    { approval: approval(), getCredential: async () => null },
  ];
  for (const input of cases) {
    const calls = { credential: 0, provider: 0 };
    await assert.rejects(executeApprovedStripeCapabilitySpike({
      ...input,
      getCredential: async () => { calls.credential += 1; return null; },
      sendRequest: async () => { calls.provider += 1; },
    }), (error) => error.message === SPIKE_EXECUTION_DISABLED_MESSAGE);
    assert.deepEqual(calls, { credential: 0, provider: 0 });
  }
  const hostile = {};
  let inputReads = 0;
  Object.defineProperties(hostile, {
    approval: { get() { inputReads += 1; throw new Error("must not inspect receipt"); } },
    getCredential: { get() { inputReads += 1; throw new Error("must not inspect callback"); } },
  });
  await assert.rejects(executeApprovedStripeCapabilitySpike(hostile), /execution is disabled/);
  assert.equal(inputReads, 0);
});

test("public production modules contain no reachable network or credential boundary", async () => {
  const [guardSource, transportSource] = await Promise.all([
    readFile(new URL("../lib/spike-guard/guard.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/spike-guard/stripe-transport.mjs", import.meta.url), "utf8"),
  ]);
  assert.equal(guardSource.includes("guard-core"), false);
  assert.equal(guardSource.includes("getCredential"), false);
  assert.equal(guardSource.includes("fetch("), false);
  assert.equal(transportSource.includes("fetch("), false);
  assert.equal(transportSource.includes("api.stripe.com"), false);
  assert.equal(transportSource.includes("Authorization"), false);
});

test("provider transport hard-disables before credential, authorization, or fetch callbacks", async () => {
  const calls = { credential: 0, authorization: 0, fetch: 0 };
  const transport = createStripeGrantedTokenTransport({
    fetchImpl: async () => { calls.fetch += 1; throw new Error("network must remain unreachable"); },
  });
  const input = {
    request: FROZEN_SPIKE_REQUEST,
    get credential() { calls.credential += 1; return { secret: "synthetic-only" }; },
    signal: new AbortController().signal,
    authorizeSend: async () => { calls.authorization += 1; },
  };
  await assert.rejects(transport(input), /transport is disabled/);
  assert.deepEqual(calls, { credential: 0, authorization: 0, fetch: 0 });
});

test("provider outcome projection drops all non-allowlisted caller strings", () => {
  const reference = `sha256:${"c".repeat(64)}`;
  const safe = projectProviderOutcome({
    statusClass: "success",
    requestReference: reference,
    objectClass: "granted_token",
    objectReference: reference,
    hasError: false,
  });
  assert.deepEqual(Object.keys(safe).sort(), ["hasError", "objectClass", "objectReference", "requestReference", "statusClass"]);
  const unsafe = {
    statusClass: "success",
    requestReference: reference,
    objectClass: "granted_token",
    objectReference: reference,
    hasError: false,
    providerMessage: "spt_raw_object secret_marker_raw_key req_raw_request",
  };
  assert.throws(() => projectProviderOutcome(unsafe), (error) => {
    assert.equal(error.message, "provider outcome is not safely classifiable");
    assert.doesNotMatch(error.message, /spt_raw|secret_marker_raw|req_raw/);
    return true;
  });
});

test("production error projection never repeats credential, token, request, or provider body text", () => {
  const raw = "secret_marker_distinctive spt_distinctive req_distinctive provider body";
  const safe = sanitizeExecutionFailure(new Error(raw));
  assert.equal(safe.message, SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.equal(safe.cause, undefined);
  assert.doesNotMatch(`${safe.message} ${safe.stack}`, /secret_marker_distinctive|spt_distinctive|req_distinctive|provider body/);
});

test("disabled transport ignores credential-shaped input and suppresses all callbacks", async () => {
  const calls = { fetch: 0, credential: 0, authorization: 0 };
  const transport = createStripeGrantedTokenTransport({
    fetchImpl: async () => { calls.fetch += 1; return {}; },
  });
  const input = {
    get credential() { calls.credential += 1; return { secret: "synthetic-secret-only" }; },
    get request() { return FROZEN_SPIKE_REQUEST; },
    get signal() { return new AbortController().signal; },
    authorizeSend: async () => { calls.authorization += 1; },
  };
  await assert.rejects(transport(input), /transport is disabled/);
  assert.deepEqual(calls, { fetch: 0, credential: 0, authorization: 0 });
});

test("approval lease is immutable, anchored once, at most 600s, and capped by outer end", () => {
  const lease = createApprovalLease({ approval: approval(), nowEpoch: EXECUTION_EPOCH });
  assert.deepEqual(lease, {
    approvalId: APPROVED_APPROVAL_ID,
    approvedAtEpoch: EXECUTION_EPOCH,
    startsAtEpoch: EXECUTION_EPOCH,
    endsAtEpoch: EXECUTION_EPOCH + 600,
    requestHash: FROZEN_REQUEST_HASH,
    clockAuthority: CLOCK_AUTHORITY,
  });
  assert.equal(Object.isFrozen(lease), true);
  const nearEnd = OUTER_END_EPOCH - 300;
  assert.equal(createApprovalLease({ approval: approval({ approvedAtEpoch: nearEnd }), nowEpoch: nearEnd }).endsAtEpoch, OUTER_END_EPOCH);
  const shortLease = createApprovalLease({ approval: approval({ durationSeconds: 1 }), nowEpoch: EXECUTION_EPOCH });
  const shortStoreLease = Object.freeze({ ...shortLease });
  assert.equal(shortStoreLease.endsAtEpoch, EXECUTION_EPOCH + 1);
});

test("one-shot claim is start-inclusive and lease-end-exclusive", async (t) => {
  const activeDirectory = await tempState(t);
  const expiredDirectory = await tempState(t);
  const lease = createApprovalLease({ approval: approval({ durationSeconds: 1 }), nowEpoch: EXECUTION_EPOCH });
  await createFilesystemOneShot({ directory: activeDirectory }).claim({ lease, claimedAtEpoch: EXECUTION_EPOCH });
  await assert.rejects(
    createFilesystemOneShot({ directory: expiredDirectory }).claim({ lease, claimedAtEpoch: EXECUTION_EPOCH + 1 }),
    /not active/,
  );
});

test("approval lease rejects stale/non-immediate approval, extension, re-anchor inputs, wrong authority/window/hash, and outside-window approval", () => {
  const cases = [
    { approval: approval(), nowEpoch: EXECUTION_EPOCH + 1 },
    { approval: approval({ durationSeconds: 601 }), nowEpoch: EXECUTION_EPOCH },
    { approval: approval({ durationSeconds: 0 }), nowEpoch: EXECUTION_EPOCH },
    { approval: approval({ approvedAtEpoch: EXECUTION_EPOCH - 1 }), nowEpoch: EXECUTION_EPOCH },
    { approval: approval({ clockAuthority: "session-date" }), nowEpoch: EXECUTION_EPOCH },
    { approval: approval({ outerStartEpoch: OUTER_START_EPOCH + 1 }), nowEpoch: EXECUTION_EPOCH },
    { approval: approval({ outerEndEpoch: OUTER_END_EPOCH + 1 }), nowEpoch: EXECUTION_EPOCH },
    { approval: approval({ requestHash: "0".repeat(64) }), nowEpoch: EXECUTION_EPOCH },
    { approval: approval({ approvalId: "OTHER-PACKAGE-ID" }), nowEpoch: EXECUTION_EPOCH },
    { approval: approval({ approvedAtEpoch: OUTER_START_EPOCH - 1 }), nowEpoch: OUTER_START_EPOCH - 1 },
    { approval: approval({ approvedAtEpoch: OUTER_END_EPOCH }), nowEpoch: OUTER_END_EPOCH },
  ];
  for (const input of cases) assert.throws(() => createApprovalLease(input));
});

test("filesystem one-shot claim is atomic, immutable, and cannot re-anchor", async (t) => {
  const directory = await tempState(t);
  const store = createFilesystemOneShot({ directory });
  const lease = createApprovalLease({ approval: approval(), nowEpoch: EXECUTION_EPOCH });
  const [a, b] = await Promise.allSettled([
    store.claim({ lease, claimedAtEpoch: EXECUTION_EPOCH }),
    store.claim({ lease: { ...lease, approvedAtEpoch: EXECUTION_EPOCH + 1 }, claimedAtEpoch: EXECUTION_EPOCH }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), ["fulfilled", "rejected"]);
  await assert.rejects(store.claim({ lease, claimedAtEpoch: EXECUTION_EPOCH }));
  const record = JSON.parse(await readFile(join(directory, "stripe-spike-one-shot", "claim.json"), "utf8"));
  assert.equal(record.requestHash, FROZEN_REQUEST_HASH);
  assert.equal(record.approvedAtEpoch, EXECUTION_EPOCH);
  assert.equal(record.claimedAtEpoch, EXECUTION_EPOCH);
});

test("guard success consumes claim before injected fake credential and dispatch", async (t) => {
  const directory = await tempState(t);
  const fake = spies();
  const result = await executeStripeSpikeGuardCore({
    request: structuredClone(FROZEN_SPIKE_REQUEST),
    approval: approval(),
    stateDirectory: directory,
    captureClock: clockCapture(),
    getCredential: fake.credential,
    sendRequest: fake.dispatch,
  });
  assert.equal(result.status, "dispatched");
  assert.equal(result.requestHash, FROZEN_REQUEST_HASH);
  assert.deepEqual(fake.calls, { credential: 1, dispatch: 1 });
  const record = JSON.parse(await readFile(join(directory, "stripe-spike-one-shot", "claim.json"), "utf8"));
  assert.equal(record.status, "consumed-before-dispatch");
});

test("lease expiry immediately before credential retrieval blocks both callbacks", async (t) => {
  const directory = await tempState(t);
  const fake = spies();
  await assert.rejects(executeStripeSpikeGuardCore({
    request: structuredClone(FROZEN_SPIKE_REQUEST),
    approval: approval({ durationSeconds: 1 }),
    stateDirectory: directory,
    captureClock: clockCapture({ epochs: [EXECUTION_EPOCH, EXECUTION_EPOCH + 1] }),
    getCredential: fake.credential,
    sendRequest: fake.dispatch,
  }), (error) => error.message === SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.deepEqual(fake.calls, { credential: 0, dispatch: 0 });
});

test("lease expiry after credential retrieval blocks dispatch and permanently consumes the claim", async (t) => {
  const directory = await tempState(t);
  const fake = spies();
  const input = {
    request: structuredClone(FROZEN_SPIKE_REQUEST),
    approval: approval({ durationSeconds: 1 }),
    stateDirectory: directory,
    captureClock: clockCapture({ epochs: [EXECUTION_EPOCH, EXECUTION_EPOCH, EXECUTION_EPOCH + 1] }),
    getCredential: fake.credential,
    sendRequest: fake.dispatch,
  };
  await assert.rejects(executeStripeSpikeGuardCore(input), (error) => error.message === SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.deepEqual(fake.calls, { credential: 1, dispatch: 0 });
  const second = spies();
  await assert.rejects(executeStripeSpikeGuardCore({ ...input, captureClock: clockCapture(), getCredential: second.credential, sendRequest: second.dispatch }), (error) => error.message === SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.deepEqual(second.calls, { credential: 0, dispatch: 0 });
});

test("abort-aware transport is anchored to the absolute lease deadline and cannot send afterward", async (t) => {
  const directory = await tempState(t);
  let actualSends = 0;
  const startedAt = Date.now();
  const captureMs = EXECUTION_EPOCH * 1000 + 900;
  await assert.rejects(executeStripeSpikeGuardCore({
    request: structuredClone(FROZEN_SPIKE_REQUEST),
    approval: approval({ durationSeconds: 1 }),
    stateDirectory: directory,
    captureClock: clockCapture({ capturedAtMs: [captureMs, captureMs, captureMs, captureMs] }),
    getCredential: async () => ({ secret: "test_secret_placeholder", account: FROZEN_SPIKE_REQUEST.account, livemode: false }),
    sendRequest: async ({ signal, authorizeSend }) => {
      await authorizeSend();
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
      if (!signal.aborted) actualSends += 1;
      throw signal.reason;
    },
  }), (error) => error.message === SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.equal(actualSends, 0);
  assert.ok(Date.now() - startedAt < 500, "deadline must use the remaining absolute milliseconds, not a fresh full second");
});

test("credential metadata must match the approved account and test mode before dispatch", async (t) => {
  for (const credential of [
    Object.freeze({ kind: "fake", account: "acct_wrong", livemode: false }),
    Object.freeze({ kind: "fake", account: FROZEN_SPIKE_REQUEST.account, livemode: true }),
    Object.freeze({ kind: "fake", account: FROZEN_SPIKE_REQUEST.account }),
  ]) {
    const directory = await tempState(t);
    let credentialCalls = 0;
    let dispatchCalls = 0;
    await assert.rejects(executeStripeSpikeGuardCore({
      request: structuredClone(FROZEN_SPIKE_REQUEST),
      approval: approval(),
      stateDirectory: directory,
      captureClock: clockCapture(),
      getCredential: async () => { credentialCalls += 1; return credential; },
      sendRequest: async () => { dispatchCalls += 1; },
    }));
    assert.equal(credentialCalls, 1);
    assert.equal(dispatchCalls, 0);
  }
});

test("every pre-dispatch rejection leaves credential and dispatch callbacks at zero", async (t) => {
  const scenarios = [
    { captureClock: clockCapture({ epochs: [OUTER_START_EPOCH - 1] }), approval: approval({ approvedAtEpoch: OUTER_START_EPOCH - 1 }) },
    { captureClock: clockCapture({ epochs: [OUTER_END_EPOCH] }), approval: approval({ approvedAtEpoch: OUTER_END_EPOCH }) },
    { captureClock: clockCapture({ evidence: { observedAtEpoch: EXECUTION_EPOCH - 61 } }) },
    { captureClock: clockCapture({ evidence: { exitCode: 1 } }) },
    { request: cloneRequest((r) => { r.body.payment_method = "pm_other"; }) },
    { request: cloneRequest((r) => { r.account = "acct_other"; }) },
    { request: cloneRequest((r) => { r.stripeApiVersion = "wrong"; }) },
    { request: cloneRequest((r) => { r.capability = "wrong_spt"; }) },
    { request: cloneRequest((r) => { r.transport.retry = true; }) },
    { request: cloneRequest((r) => { r.transport.followRedirects = true; }) },
    { request: cloneRequest((r) => { r.transport.fallback = true; }) },
    { request: cloneRequest((r) => { r.transport.resubmit = true; }) },
    { approval: approval({ approvedAtEpoch: EXECUTION_EPOCH - 1 }) },
    { approval: approval({ durationSeconds: 601 }) },
  ];
  for (const [index, scenario] of scenarios.entries()) {
    const directory = await tempState(t);
    const fake = spies();
    await assert.rejects(executeStripeSpikeGuardCore({
      request: structuredClone(FROZEN_SPIKE_REQUEST),
      approval: approval(),
      stateDirectory: directory,
      captureClock: clockCapture(),
      getCredential: fake.credential,
      sendRequest: fake.dispatch,
      ...scenario,
    }), undefined, `scenario ${index}`);
    assert.deepEqual(fake.calls, { credential: 0, dispatch: 0 }, `scenario ${index}`);
  }
});

test("duplicate and race attempts permit exactly one fake credential and dispatch call", async (t) => {
  const directory = await tempState(t);
  const fake = spies();
  const input = {
    request: structuredClone(FROZEN_SPIKE_REQUEST),
    approval: approval(),
    stateDirectory: directory,
    captureClock: clockCapture(),
    getCredential: fake.credential,
    sendRequest: fake.dispatch,
  };
  const race = await Promise.allSettled([
    executeStripeSpikeGuardCore(input),
    executeStripeSpikeGuardCore(input),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(race.filter((r) => r.status === "rejected").length, 1);
  assert.deepEqual(fake.calls, { credential: 1, dispatch: 1 });
});

test("ambiguous dispatch failure consumes claim and never permits a second credential or dispatch", async (t) => {
  const directory = await tempState(t);
  const first = spies({ dispatchError: new Error("secret_marker spt_private req_private provider-private-body") });
  const input = {
    request: structuredClone(FROZEN_SPIKE_REQUEST),
    approval: approval(),
    stateDirectory: directory,
    captureClock: clockCapture(),
  };
  await assert.rejects(executeStripeSpikeGuardCore({ ...input, getCredential: first.credential, sendRequest: first.dispatch }), (error) => error.message === SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.deepEqual(first.calls, { credential: 1, dispatch: 1 });
  const second = spies();
  await assert.rejects(executeStripeSpikeGuardCore({ ...input, getCredential: second.credential, sendRequest: second.dispatch }), (error) => error.message === SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.deepEqual(second.calls, { credential: 0, dispatch: 0 });
});

test("credential callback failure also leaves the one-shot claim consumed", async (t) => {
  const directory = await tempState(t);
  let credentialCalls = 0;
  const input = {
    request: structuredClone(FROZEN_SPIKE_REQUEST),
    approval: approval(),
    stateDirectory: directory,
    captureClock: clockCapture(),
    getCredential: async () => { credentialCalls += 1; throw new Error("secret_marker spt_private req_private provider-private-body"); },
    sendRequest: async () => { throw new Error("must not dispatch"); },
  };
  await assert.rejects(executeStripeSpikeGuardCore(input), (error) => error.message === SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.equal(credentialCalls, 1);
  await assert.rejects(executeStripeSpikeGuardCore(input), (error) => error.message === SAFE_EXECUTION_FAILURE_MESSAGE);
  assert.equal(credentialCalls, 1);
});
