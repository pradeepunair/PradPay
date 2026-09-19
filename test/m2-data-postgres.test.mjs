import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(path.join(root, "db/migrations/202609180001_m2_persistence_foundation/up.sql"), "utf8");
const rollback = readFileSync(path.join(root, "db/migrations/202609180001_m2_persistence_foundation/down.sql"), "utf8");
const container = process.env.PAYMENTLAB_POSTGRES_CONTAINER ?? "paymentlab-postgres";
const database = `paymentlab_m2_data_${process.pid}_${Date.now()}`.toLowerCase();

function dockerShell(command, args = [], input) {
  return execFileSync("docker", ["exec", "-i", container, "sh", "-lc", command, "paymentlab-test", ...args], {
    input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
  }).trim();
}
function psql(sql, db = database) {
  return dockerShell('psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', [db], sql);
}
function psqlFails(sql, pattern, db = database) {
  assert.throws(() => psql(sql, db), pattern);
}
function psqlAsync(sql, db = database) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "sh", "-lc", 'psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', "paymentlab-test", db]);
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`psql exited ${code}: ${stderr}`)));
    child.stdin.end(sql);
  });
}
function createDatabase(name) {
  dockerShell('createdb -U "$POSTGRES_USER" "$1"', [name]);
}
function dropDatabase(name) {
  dockerShell('dropdb --if-exists --force -U "$POSTGRES_USER" "$1"', [name]);
}
function seedOwner(prefix = "base") {
  psql(`
    INSERT INTO visitor_sessions(id,expires_at,admission_limit) VALUES ('${prefix}_s1',now()+interval '1 day',10),('${prefix}_s2',now()+interval '1 day',10);
    INSERT INTO runs(id,session_id,mode,scenario,state,reference_time,schema_version)
    VALUES ('${prefix}_r1','${prefix}_s1','guided_replay','synthetic','queued',now(),'1.0.0');
  `);
}
function leaseOneSql(owner, token) {
  return `WITH exhausted AS (
    UPDATE outbox_jobs SET state='dead',lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now()
      WHERE attempt_count>=max_attempts
        AND ((state='pending' AND available_at<=now()) OR (state='leased' AND lease_expires_at<=now()))
  ), candidates AS (
    SELECT id FROM outbox_jobs
      WHERE ((state='pending' AND available_at<=now()) OR (state='leased' AND lease_expires_at<=now()))
        AND attempt_count < max_attempts
      ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE outbox_jobs j SET state='leased',lease_owner='${owner}',lease_token='${token}',
    lease_expires_at=now()+interval '1 minute',attempt_count=j.attempt_count+1,updated_at=now()
    FROM candidates c WHERE j.id=c.id RETURNING j.id;`;
}

before(() => {
  const identity = dockerShell('printf "%s|%s" "$POSTGRES_USER" "$POSTGRES_DB"');
  assert.match(identity, /^.+\|.+$/);
  createDatabase(database);
  psql(migration);
  psql(migration);
});
after(() => dropDatabase(database));

test("empty apply is repeatable and exposes required tables, foreign keys, checks, and indexes", () => {
  const tables = psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';");
  assert.equal(tables, "15");
  const constraints = psql("SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype IN ('f','u','c','p');");
  assert.ok(Number(constraints) >= 55, constraints);
  const indexes = psql("SELECT string_agg(indexname,',' ORDER BY indexname) FROM pg_indexes WHERE schemaname='public';");
  for (const required of ["domain_events_owner_sequence_idx","payment_attempts_one_active_checkout_idx","payment_attempts_one_success_mandate_idx","mandate_usages_one_success_idx","outbox_jobs_lease_idx","webhook_receipts_provider_provider_event_id_key"]) {
    assert.match(indexes, new RegExp(required));
  }
  const moneyTypes = psql("SELECT string_agg(DISTINCT data_type,',' ORDER BY data_type) FROM information_schema.columns WHERE table_schema='public' AND column_name LIKE '%\\_minor' ESCAPE '\\';");
  assert.equal(moneyTypes, "bigint");
  const timestampTypes = psql("SELECT string_agg(DISTINCT data_type,',' ORDER BY data_type) FROM information_schema.columns WHERE table_schema='public' AND (column_name LIKE '%\\_at' ESCAPE '\\' OR column_name LIKE '%\\_time' ESCAPE '\\');");
  assert.equal(timestampTypes, "timestamp with time zone");
});

test("rollback rehearsal removes and then reapplies the additive schema only in a disposable database", () => {
  const rehearsal = `${database}_rollback`;
  createDatabase(rehearsal);
  try {
    psql(migration, rehearsal);
    psql(rollback, rehearsal);
    assert.equal(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';", rehearsal), "0");
    psql(migration, rehearsal);
    assert.equal(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public';", rehearsal), "15");
  } finally { dropDatabase(rehearsal); }
});

test("session/run ownership fails closed and mutation plus event roll back atomically", () => {
  seedOwner("owner");
  psqlFails("SELECT append_domain_event('owner_bad','owner_r1','owner_s2','run.updated','1.0.0','{}');", /run not found in session scope/);
  psql(`BEGIN;
    UPDATE runs SET state='running' WHERE id='owner_r1' AND session_id='owner_s1';
    SELECT append_domain_event('owner_rolled_back','owner_r1','owner_s1','run.updated','1.0.0','{}');
    ROLLBACK;`);
  assert.equal(psql("SELECT state||'|'||next_event_sequence FROM runs WHERE id='owner_r1';"), "queued|0");
  assert.equal(psql("SELECT count(*) FROM domain_events WHERE event_id='owner_rolled_back';"), "0");
});

test("concurrent event writers allocate a unique contiguous per-run sequence and duplicate IDs fail", async () => {
  seedOwner("seq");
  const writers = Array.from({ length: 16 }, (_, index) => psqlAsync(
    `SELECT append_domain_event('seq_evt_${index}','seq_r1','seq_s1','test.event','1.0.0','{"writer":${index}}');`,
  ));
  const allocated = (await Promise.all(writers)).map(Number).sort((a, b) => a - b);
  assert.deepEqual(allocated, Array.from({ length: 16 }, (_, index) => index + 1));
  assert.equal(psql("SELECT count(*)||'|'||min(sequence)||'|'||max(sequence)||'|'||count(DISTINCT sequence) FROM domain_events WHERE run_id='seq_r1';"), "16|1|16|16");
  seedOwner("seq2");
  psqlFails("SELECT append_domain_event('seq_evt_0','seq2_r1','seq2_s1','test.event','1.0.0','{}');", /duplicate key value/);
  assert.equal(psql("SELECT next_event_sequence FROM runs WHERE id='seq2_r1';"), "0");
});

test("idempotency hashes are immutable and provider event IDs are unique", () => {
  seedOwner("idem");
  assert.equal(psql("SELECT claim_idempotency('idem_s1','checkout.create','key_1','hash_a');"), "created");
  assert.equal(psql("SELECT claim_idempotency('idem_s1','checkout.create','key_1','hash_a');"), "replay");
  assert.equal(psql("SELECT claim_idempotency('idem_s1','checkout.create','key_1','hash_b');"), "conflict");
  assert.equal(psql("SELECT request_hash FROM idempotency_keys WHERE session_id='idem_s1' AND scope='checkout.create' AND key='key_1';"), "hash_a");
  psqlFails("UPDATE idempotency_keys SET request_hash='hash_b' WHERE session_id='idem_s1' AND scope='checkout.create' AND key='key_1';", /immutable/);
  assert.equal(psql("SELECT record_webhook_receipt('wh_1','stripe','evt_provider_1','payment.safe','{}',now());"), "created");
  assert.equal(psql("SELECT record_webhook_receipt('wh_2','stripe','evt_provider_1','payment.safe','{}',now());"), "duplicate");
  assert.equal(psql("SELECT count(*) FROM webhook_receipts WHERE provider='stripe' AND provider_event_id='evt_provider_1';"), "1");
});

test("one active attempt per checkout and one successful mandate use are database-enforced", () => {
  seedOwner("guard");
  psql(`
    INSERT INTO checkouts(id,session_id,run_id,acp_version,state,cart_hash) VALUES ('guard_c1','guard_s1','guard_r1','2026-04-17','ready','cart_hash');
    INSERT INTO mandates(id,session_id,run_id,checkout_id,version,state,approved_text,constraints,currency,maximum_amount_minor,expires_at)
      VALUES ('guard_m1','guard_s1','guard_r1','guard_c1',1,'active','approved','{}','USD',1000,now()+interval '1 hour');
    INSERT INTO orders(id,session_id,run_id,checkout_id,state,currency,amount_minor) VALUES ('guard_o1','guard_s1','guard_r1','guard_c1','pending_payment','USD',1000);
    INSERT INTO payments(id,session_id,run_id,checkout_id,order_id,currency,amount_minor) VALUES ('guard_p1','guard_s1','guard_r1','guard_c1','guard_o1','USD',1000);
    INSERT INTO payment_attempts(id,session_id,run_id,checkout_id,payment_id,mandate_id,operation_key,request_hash,state)
      VALUES ('guard_a1','guard_s1','guard_r1','guard_c1','guard_p1','guard_m1','op_1','hash_1','prepared');
  `);
  psqlFails(`INSERT INTO payment_attempts(id,session_id,run_id,checkout_id,payment_id,mandate_id,operation_key,request_hash,state)
    VALUES ('guard_a2','guard_s1','guard_r1','guard_c1','guard_p1','guard_m1','op_2','hash_2','unknown');`, /payment_attempts_one_active_checkout_idx/);
  psql(`INSERT INTO payment_attempts(id,session_id,run_id,checkout_id,payment_id,mandate_id,operation_key,request_hash,state)
    VALUES ('guard_a2','guard_s1','guard_r1','guard_c1','guard_p1','guard_m1','op_2','hash_2','failed');
    UPDATE payment_attempts SET state='succeeded' WHERE id='guard_a1';
    INSERT INTO mandate_usages(id,mandate_id,attempt_id,status) VALUES ('guard_u1','guard_m1','guard_a1','succeeded');`);
  psqlFails("UPDATE payment_attempts SET state='succeeded' WHERE id='guard_a2';", /payment_attempts_one_success_mandate_idx/);
  psqlFails("INSERT INTO mandate_usages(id,mandate_id,attempt_id,status) VALUES ('guard_u2','guard_m1','guard_a2','succeeded');", /mandate_usages_one_success_idx/);
});

test("business records cannot combine owners and unset provider references remain non-unique", () => {
  seedOwner("scope");
  psql(`
    INSERT INTO runs(id,session_id,mode,scenario,state,reference_time,schema_version)
      VALUES ('scope_r2','scope_s2','guided_replay','synthetic','queued',now(),'1.0.0');
    INSERT INTO checkouts(id,session_id,run_id,acp_version,state,cart_hash)
      VALUES ('scope_c1','scope_s1','scope_r1','2026-04-17','ready','hash_1'),
             ('scope_c2','scope_s2','scope_r2','2026-04-17','ready','hash_2'),
             ('scope_c3','scope_s1','scope_r1','2026-04-17','ready','hash_3');
    INSERT INTO orders(id,session_id,run_id,checkout_id,state,currency,amount_minor)
      VALUES ('scope_o1','scope_s1','scope_r1','scope_c1','pending_payment','USD',1000);
    INSERT INTO payments(id,session_id,run_id,checkout_id,order_id,currency,amount_minor)
      VALUES ('scope_p1','scope_s1','scope_r1','scope_c1','scope_o1','USD',1000),
             ('scope_p2','scope_s1','scope_r1','scope_c1','scope_o1','USD',1000);
  `);
  psqlFails(`INSERT INTO orders(id,session_id,run_id,checkout_id,state,currency,amount_minor)
    VALUES ('scope_bad_order','scope_s1','scope_r1','scope_c2','pending_payment','USD',1000);`, /foreign key/);
  psqlFails(`INSERT INTO payments(id,session_id,run_id,checkout_id,order_id,currency,amount_minor,provider,provider_reference)
    VALUES ('scope_bad_payment','scope_s1','scope_r1','scope_c1','scope_o1','USD',1000,'provider',NULL);`, /check constraint/);
  psqlFails(`INSERT INTO payments(id,session_id,run_id,checkout_id,order_id,currency,amount_minor)
    VALUES ('scope_wrong_checkout','scope_s1','scope_r1','scope_c3','scope_o1','USD',1000);`, /foreign key/);
  psql(`INSERT INTO mandates(id,session_id,run_id,checkout_id,version,state,approved_text,constraints,currency,maximum_amount_minor,expires_at)
    VALUES ('scope_m3','scope_s1','scope_r1','scope_c3',1,'active','approved','{}','USD',1000,now()+interval '1 hour');`);
  psqlFails(`INSERT INTO payment_attempts(id,session_id,run_id,checkout_id,payment_id,mandate_id,operation_key,request_hash,state)
    VALUES ('scope_wrong_mandate','scope_s1','scope_r1','scope_c1','scope_p1','scope_m3','scope_op','scope_hash','prepared');`, /foreign key/);
});

test("outbox dedupe and lease shape are durable and fenced", () => {
  seedOwner("outbox");
  psql(`INSERT INTO outbox_jobs(id,session_id,run_id,kind,dedupe_key,safe_payload)
    VALUES ('outbox_j1','outbox_s1','outbox_r1','demo','dedupe_1','{}');`);
  psqlFails(`INSERT INTO outbox_jobs(id,session_id,run_id,kind,dedupe_key,safe_payload)
    VALUES ('outbox_j2','outbox_s1','outbox_r1','demo','dedupe_1','{}');`, /duplicate key value/);
  psqlFails("UPDATE outbox_jobs SET state='leased' WHERE id='outbox_j1';", /outbox_jobs_check/);
  psql("UPDATE outbox_jobs SET state='leased',lease_owner='worker',lease_token='fence',lease_expires_at=now()+interval '1 minute' WHERE id='outbox_j1';");
  assert.equal(psql("SELECT state||'|'||lease_owner||'|'||lease_token FROM outbox_jobs WHERE id='outbox_j1';"), "leased|worker|fence");
});

test("outbox workers are mutually exclusive, recover expired leases, and reject stale fences", async () => {
  seedOwner("fence");
  psql(`INSERT INTO outbox_jobs(id,session_id,run_id,kind,dedupe_key,safe_payload,max_attempts)
    VALUES ('fence_j1','fence_s1','fence_r1','demo','fence_d1','{}',3);`);
  const claims = await Promise.all([
    psqlAsync(leaseOneSql("worker_a", "token_a")),
    psqlAsync(leaseOneSql("worker_b", "token_b")),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  const firstFence = psql("SELECT lease_owner||'|'||lease_token FROM outbox_jobs WHERE id='fence_j1';");
  const [firstOwner, firstToken] = firstFence.split("|");
  psql("UPDATE outbox_jobs SET lease_expires_at=now()-interval '1 second' WHERE id='fence_j1';");
  assert.equal(psql(leaseOneSql("worker_recovery", "token_recovery")), "fence_j1");
  assert.equal(psql(`WITH ack AS (UPDATE outbox_jobs SET state='succeeded',lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL
    WHERE id='fence_j1' AND state='leased' AND lease_owner='${firstOwner}' AND lease_token='${firstToken}' AND lease_expires_at>now()
    RETURNING id) SELECT count(*) FROM ack;`), "0");
  assert.equal(psql(`WITH ack AS (UPDATE outbox_jobs SET state='succeeded',lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL
    WHERE id='fence_j1' AND state='leased' AND lease_owner='worker_recovery' AND lease_token='token_recovery' AND lease_expires_at>now()
    RETURNING id) SELECT count(*) FROM ack;`), "1");

  psql(`INSERT INTO outbox_jobs(id,session_id,run_id,kind,dedupe_key,safe_payload,max_attempts)
    VALUES ('fence_j2','fence_s1','fence_r1','demo','fence_d2','{}',1);`);
  assert.equal(psql(leaseOneSql("worker_final", "token_final")), "fence_j2");
  psql("UPDATE outbox_jobs SET lease_expires_at=now()-interval '1 second' WHERE id='fence_j2';");
  assert.equal(psql(leaseOneSql("worker_late", "token_late")), "");
  assert.equal(psql("SELECT state||'|'||(lease_owner IS NULL)::text||'|'||(lease_token IS NULL)::text FROM outbox_jobs WHERE id='fence_j2';"), "dead|true|true");
});
