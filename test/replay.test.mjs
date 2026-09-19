import assert from "node:assert/strict";
import test from "node:test";

import {
  loadRecording,
  listRecordings,
  projectRecording,
  validateRecording,
} from "../lib/replay/store.mjs";
import { initialProjection } from "../lib/replay/reducer.mjs";

test("loads only versioned synthetic development fixtures", async () => {
  const recordings = await listRecordings();
  assert.deepEqual(recordings.map((entry) => entry.slug), ["synthetic-success-v1"]);

  const recording = await loadRecording("synthetic-success-v1");
  assert.equal(recording.schemaVersion, "1.0.0");
  assert.equal(recording.source, "synthetic_development_fixture");
  assert.equal(recording.mode, "guided_replay");
});

test("rejects malformed recording sequences and unsafe source labels", () => {
  const base = {
    schemaVersion: "1.0.0",
    slug: "bad",
    source: "synthetic_development_fixture",
    mode: "guided_replay",
    title: "Bad fixture",
    description: "A deliberately invalid fixture.",
    referenceTime: "2026-09-07T20:00:00.000Z",
    durationMs: 1000,
    catalog: [],
    events: [],
  };

  assert.throws(
    () => validateRecording({ ...base, source: "recorded_live_run" }),
    /Unsupported recording source/,
  );
  assert.throws(
    () =>
      validateRecording({
        ...base,
        events: [
          { eventId: "one", sequence: 2, type: "run.started", summary: "one", occurredAt: "2026-09-07T20:00:00.000Z", actor: "system", explanation: "one", evidenceRefs: [], patch: {} },
          { eventId: "two", sequence: 2, type: "run.completed", summary: "two", occurredAt: "2026-09-07T20:00:01.000Z", actor: "system", explanation: "two", evidenceRefs: [], patch: {} },
        ],
      }),
    /strictly increasing/,
  );

  assert.throws(
    () => validateRecording({
      ...base,
      events: [{
        eventId: "unsafe",
        sequence: 1,
        type: "run.started",
        summary: "unsafe",
        occurredAt: "2026-09-07T20:00:00.000Z",
        actor: "system",
        explanation: "unsafe",
        evidenceRefs: [],
        patch: { shared: { inventedFutureFact: "no" } },
      }],
    }),
    /Unknown projection field/,
  );

  assert.throws(
    () => validateRecording({
      ...base,
      events: [{
        eventId: "wrong-type", sequence: 1, type: "quote.created",
        summary: "wrong", occurredAt: "2026-09-07T20:00:00.000Z",
        actor: "system", explanation: "wrong", evidenceRefs: [],
        patch: { shared: { totalMinor: "303.19" } },
      }],
    }),
    /Invalid projection value/,
  );

  assert.throws(
    () => validateRecording({
      ...base,
      events: [{
        eventId: "gap", sequence: 2, type: "run.started",
        summary: "gap", occurredAt: "2026-09-07T20:00:00.000Z",
        actor: "system", explanation: "gap", evidenceRefs: [], patch: {},
      }],
    }),
    /contiguous/,
  );
});

test("the exported replay baseline is deeply immutable", () => {
  assert.equal(Object.isFrozen(initialProjection.shared), true);
  assert.equal(Object.isFrozen(initialProjection.buyer.requirements), true);
  assert.throws(() => initialProjection.buyer.requirements.push("future fact"), TypeError);
});

test("rewind projection exposes no future event or derived fact", async () => {
  const recording = await loadRecording("synthetic-success-v1");
  const beforePayment = projectRecording(recording, 6);
  const afterPayment = projectRecording(recording, recording.events.length);

  assert.equal(beforePayment.visibleEvents.every((event) => event.sequence <= 6), true);
  assert.equal(beforePayment.shared.paymentStatus, "not_submitted");
  assert.equal(beforePayment.psp.providerReference, null);
  assert.equal(afterPayment.shared.paymentStatus, "succeeded");
  assert.match(afterPayment.psp.providerReference, /^pi_demo_/);
});

test("unknown future event types are retained as safe timeline facts but do not mutate projections", async () => {
  const recording = await loadRecording("synthetic-success-v1");
  const unknown = {
    eventId: "evt_unknown",
    sequence: recording.events.length + 1,
    type: "future.event",
    actor: "system",
    summary: "A newer renderer may understand this event.",
    occurredAt: "2026-09-07T20:00:30.000Z",
    explanation: "Ignored by projection version 1.",
    evidenceRefs: [],
    patch: { shared: { paymentStatus: "fabricated" } },
  };
  const extended = { ...recording, events: [...recording.events, unknown] };
  const projection = projectRecording(extended, unknown.sequence);

  assert.equal(projection.visibleEvents.at(-1).type, "future.event");
  assert.equal(projection.shared.paymentStatus, "succeeded");
});
