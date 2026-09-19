import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresPersistence } from "../lib/persistence/postgres.mjs";

function fakePool(handler = async () => ({ rows: [], rowCount: 0 })) {
  const calls = [];
  const client = {
    async query(text, values) { calls.push({ text, values }); return handler(text, values, calls); },
    release() { calls.push({ text: "RELEASE" }); },
  };
  return { calls, connect: async () => client };
}

test("withTransaction commits successful work and always releases", async () => {
  const pool = fakePool();
  const persistence = createPostgresPersistence(pool);
  const result = await persistence.withTransaction(async () => "ok");
  assert.equal(result, "ok");
  assert.deepEqual(pool.calls.map((call) => call.text), ["BEGIN", "COMMIT", "RELEASE"]);
});

test("withTransaction rolls back failed mutation/event work", async () => {
  const pool = fakePool();
  const persistence = createPostgresPersistence(pool);
  await assert.rejects(persistence.withTransaction(async () => { throw new Error("mutation failed"); }), /mutation failed/);
  assert.deepEqual(pool.calls.map((call) => call.text), ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("appendDomainEvent uses the scoped atomic allocator and rejects unsafe payloads", async () => {
  const pool = fakePool(async (text) => text.startsWith("SELECT append_domain_event") ? { rows: [{ sequence: "7" }] } : { rows: [] });
  const persistence = createPostgresPersistence(pool);
  const tx = await pool.connect();
  const event = await persistence.appendDomainEvent(tx, {
    eventId: "evt_7", runId: "run_1", sessionId: "session_1", type: "checkout.updated",
    schemaVersion: "1.0.0", safePayload: { checkoutId: "checkout_1" },
  });
  assert.equal(event.sequence, 7);
  assert.deepEqual(pool.calls[0].values.slice(0, 3), ["evt_7", "run_1", "session_1"]);
  await assert.rejects(
    persistence.appendDomainEvent(tx, { ...event, eventId: "evt_8", safePayload: { raw_payload: "no" } }),
    /not permitted/,
  );
});

test("idempotency and webhook contracts return database outcomes and reject raw bodies", async () => {
  const pool = fakePool(async (text) => {
    if (text.startsWith("SELECT claim_idempotency")) return { rows: [{ outcome: "replay" }] };
    if (text.startsWith("SELECT record_webhook_receipt")) return { rows: [{ outcome: "created" }] };
    return { rows: [] };
  });
  const persistence = createPostgresPersistence(pool);
  const tx = await pool.connect();
  assert.equal(await persistence.claimIdempotency(tx, { sessionId: "s", scope: "checkout", key: "k", requestHash: "h" }), "replay");
  assert.equal(await persistence.recordWebhookReceipt(tx, { id: "w", provider: "stripe", providerEventId: "e", eventType: "safe", safePayload: {} }), "created");
  await assert.rejects(
    persistence.recordWebhookReceipt(tx, { id: "w", provider: "stripe", providerEventId: "e", eventType: "safe", safePayload: {}, rawBody: "no" }),
    /rawBody is not accepted/,
  );
  await assert.rejects(
    persistence.recordWebhookReceipt(tx, { id: "w", provider: "provider", providerEventId: "e", eventType: "safe", safePayload: {}, endpointSecret: "no" }),
    /not permitted/,
  );
});

test("all resource lookups require session scope and leases use owner/token fencing", async () => {
  const pool = fakePool(async (text) => text.startsWith("SELECT * FROM runs") ? { rows: [] } : { rows: [], rowCount: 0 });
  const persistence = createPostgresPersistence(pool);
  const tx = await pool.connect();
  await assert.rejects(persistence.getRun(tx, { runId: "r" }), /sessionId/);
  assert.equal(await persistence.getRun(tx, { sessionId: "s", runId: "r" }), null);
  const lookup = pool.calls.find((call) => call.text.startsWith("SELECT * FROM runs"));
  assert.match(lookup.text, /session_id=\$1 AND id=\$2/);
  assert.equal(await persistence.ackOutboxJob(tx, { id: "j", owner: "worker", token: "fence" }), false);
  const ack = pool.calls.find((call) => call.text.startsWith("UPDATE outbox_jobs SET state='succeeded'"));
  assert.match(ack.text, /lease_owner=\$2 AND lease_token=\$3 AND lease_expires_at>now\(\)/);
});

test("outbox creation validates retry bounds and leasing retires exhausted work", async () => {
  const pool = fakePool(async (text) => {
    if (text.includes("UPDATE outbox_jobs j SET state='leased'")) return { rows: [{ id: "job_1" }] };
    return { rows: [], rowCount: 0 };
  });
  const persistence = createPostgresPersistence(pool);
  const tx = await pool.connect();
  await assert.rejects(
    persistence.createOutboxJob(tx, {
      id: "job_1", sessionId: "session_1", runId: "run_1", kind: "demo",
      dedupeKey: "demo_1", safePayload: {}, maxAttempts: 0,
    }),
    /maxAttempts/,
  );
  assert.deepEqual(await persistence.leaseOutboxJobs(tx, { owner: "worker" }), [{ id: "job_1" }]);
  const lease = pool.calls.find((call) => call.text.includes("UPDATE outbox_jobs j SET state='leased'"));
  assert.match(lease.text, /exhausted AS/);
  assert.match(lease.text, /state='dead'/);
});
