import { randomUUID } from "node:crypto";

import { assertSafeEventPayload } from "../events/safe-payload.mjs";

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} must be a non-empty string`);
}
function transaction(tx) {
  if (!tx || typeof tx.query !== "function") throw new TypeError("a transaction-scoped query client is required");
  return tx;
}

export class PostgresPersistence {
  constructor(pool) {
    if (!pool || typeof pool.connect !== "function") throw new TypeError("pool.connect is required");
    this.pool = pool;
  }

  async withTransaction(work) {
    if (typeof work !== "function") throw new TypeError("work must be a function");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch (rollbackError) { error.rollbackError = rollbackError; }
      throw error;
    } finally {
      client.release();
    }
  }

  async appendDomainEvent(tx, event) {
    transaction(tx);
    for (const name of ["eventId", "runId", "sessionId", "type", "schemaVersion"]) required(event?.[name], name);
    assertSafeEventPayload(event.safePayload);
    const result = await tx.query(
      "SELECT append_domain_event($1,$2,$3,$4,$5,$6::jsonb) AS sequence",
      [event.eventId, event.runId, event.sessionId, event.type, event.schemaVersion, JSON.stringify(event.safePayload)],
    );
    return { ...event, sequence: Number(result.rows[0].sequence) };
  }

  async claimIdempotency(tx, claim) {
    transaction(tx);
    for (const name of ["sessionId", "scope", "key", "requestHash"]) required(claim?.[name], name);
    const result = await tx.query(
      "SELECT claim_idempotency($1,$2,$3,$4) AS outcome",
      [claim.sessionId, claim.scope, claim.key, claim.requestHash],
    );
    return result.rows[0].outcome;
  }

  async recordWebhookReceipt(tx, receipt) {
    transaction(tx);
    for (const forbidden of ["rawPayload", "rawBody", "secret", "signature"]) {
      if (Object.hasOwn(receipt ?? {}, forbidden)) throw new TypeError(`${forbidden} is not accepted`);
    }
    assertSafeEventPayload(receipt, "receipt");
    for (const name of ["id", "provider", "providerEventId", "eventType"]) required(receipt?.[name], name);
    const result = await tx.query(
      "SELECT record_webhook_receipt($1,$2,$3,$4,$5::jsonb,$6::timestamptz) AS outcome",
      [receipt.id, receipt.provider, receipt.providerEventId, receipt.eventType, JSON.stringify(receipt.safePayload), receipt.occurredAt ?? null],
    );
    return result.rows[0].outcome;
  }

  async createOutboxJob(tx, job) {
    transaction(tx);
    for (const name of ["id", "sessionId", "runId", "kind", "dedupeKey"]) required(job?.[name], name);
    assertSafeEventPayload(job.safePayload);
    if (job.maxAttempts !== undefined && (!Number.isSafeInteger(job.maxAttempts) || job.maxAttempts < 1)) {
      throw new RangeError("maxAttempts must be a positive integer");
    }
    const result = await tx.query(
      `INSERT INTO outbox_jobs(id,session_id,run_id,kind,dedupe_key,safe_payload,available_at,max_attempts)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,COALESCE($7::timestamptz,now()),COALESCE($8,8))
       ON CONFLICT (dedupe_key) DO NOTHING RETURNING *`,
      [job.id, job.sessionId, job.runId, job.kind, job.dedupeKey, JSON.stringify(job.safePayload), job.availableAt ?? null, job.maxAttempts ?? null],
    );
    return result.rows[0] ? { outcome: "created", job: result.rows[0] } : { outcome: "duplicate" };
  }

  async leaseOutboxJobs(tx, { owner, limit = 10, leaseMs = 30_000, token = randomUUID() }) {
    transaction(tx); required(owner, "owner"); required(token, "token");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new RangeError("limit must be between 1 and 100");
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1) throw new RangeError("leaseMs must be positive");
    const result = await tx.query(
      `WITH exhausted AS (
         UPDATE outbox_jobs SET state='dead',lease_owner=NULL,lease_token=NULL,
                lease_expires_at=NULL,updated_at=now()
          WHERE attempt_count>=max_attempts
            AND ((state='pending' AND available_at<=now()) OR (state='leased' AND lease_expires_at<=now()))
          RETURNING id
       ), candidates AS (
         SELECT id FROM outbox_jobs
          WHERE ((state='pending' AND available_at<=now()) OR (state='leased' AND lease_expires_at<=now()))
            AND attempt_count < max_attempts
          ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE outbox_jobs j SET state='leased',lease_owner=$2,lease_token=$3,
              lease_expires_at=now()+($4*interval '1 millisecond'),attempt_count=j.attempt_count+1,updated_at=now()
        FROM candidates c WHERE j.id=c.id RETURNING j.*`,
      [limit, owner, token, leaseMs],
    );
    return result.rows;
  }

  async ackOutboxJob(tx, { id, owner, token }) {
    transaction(tx); required(id, "id"); required(owner, "owner"); required(token, "token");
    const result = await tx.query(
      `UPDATE outbox_jobs SET state='succeeded',lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now()
        WHERE id=$1 AND state='leased' AND lease_owner=$2 AND lease_token=$3 AND lease_expires_at>now() RETURNING id`,
      [id, owner, token],
    );
    return result.rowCount === 1;
  }

  async failOutboxJob(tx, { id, owner, token, terminal = false, errorCode, availableAt }) {
    transaction(tx);
    for (const [value, name] of [[id,"id"],[owner,"owner"],[token,"token"],[errorCode,"errorCode"]]) required(value, name);
    if (typeof terminal !== "boolean") throw new TypeError("terminal must be boolean");
    const result = await tx.query(
      `UPDATE outbox_jobs SET state=CASE WHEN $5::boolean OR attempt_count>=max_attempts THEN 'dead' ELSE 'pending' END,
              available_at=COALESCE($6::timestamptz,now()),last_error_code=$4,
              lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now()
        WHERE id=$1 AND state='leased' AND lease_owner=$2 AND lease_token=$3 AND lease_expires_at>now() RETURNING *`,
      [id, owner, token, errorCode, terminal, availableAt ?? null],
    );
    return result.rows[0] ?? null;
  }

  async getRun(tx, { sessionId, runId }) {
    transaction(tx); required(sessionId, "sessionId"); required(runId, "runId");
    const result = await tx.query("SELECT * FROM runs WHERE session_id=$1 AND id=$2", [sessionId, runId]);
    return result.rows[0] ?? null;
  }

  async getCheckout(tx, { sessionId, checkoutId }) {
    transaction(tx); required(sessionId, "sessionId"); required(checkoutId, "checkoutId");
    const result = await tx.query("SELECT * FROM checkouts WHERE session_id=$1 AND id=$2", [sessionId, checkoutId]);
    return result.rows[0] ?? null;
  }
}

export function createPostgresPersistence(pool) { return new PostgresPersistence(pool); }
