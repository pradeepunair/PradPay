import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const m2Up = readFileSync(path.join(root, "db/migrations/202609180001_m2_persistence_foundation/up.sql"), "utf8");
const m3Up = readFileSync(path.join(root, "db/migrations/202609190001_m3_local_safety_controls/up.sql"), "utf8");
const m3Down = readFileSync(path.join(root, "db/migrations/202609190001_m3_local_safety_controls/down.sql"), "utf8");
const container = process.env.PAYMENTLAB_POSTGRES_CONTAINER ?? "paymentlab-postgres";
const database = `paymentlab_m3_data_${process.pid}_${Date.now()}`.toLowerCase();

function dockerShell(command, args = [], input) {
  return execFileSync("docker", ["exec", "-i", container, "sh", "-lc", command, "paymentlab-m3-test", ...args], {
    input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
  }).trim();
}
function psql(sql, db = database) {
  return dockerShell('psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', [db], sql);
}
function psqlFails(sql, pattern, db = database) { assert.throws(() => psql(sql, db), pattern); }
function psqlAsync(sql, db = database) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "sh", "-lc", 'psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', "paymentlab-m3-test", db]);
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`psql exited ${code}: ${stderr}`)));
    child.stdin.end(sql);
  });
}
function createDatabase(name) { dockerShell('createdb -U "$POSTGRES_USER" "$1"', [name]); }
function dropDatabase(name) { dockerShell('dropdb --if-exists --force -U "$POSTGRES_USER" "$1"', [name]); }
function seedRun(prefix) {
  psql(`INSERT INTO visitor_sessions(id,expires_at,admission_limit) VALUES ('${prefix}_s',now()+interval '1 day',20);
    INSERT INTO runs(id,session_id,mode,scenario,state,reference_time,schema_version)
      VALUES ('${prefix}_r','${prefix}_s','guided_replay','synthetic','running',now(),'1.0.0');`);
}
function claimSql({ id, policy, session, run, operation, attempt, hash = "hash", amount = 1 }) {
  return `SELECT reserve_synthetic_budget('${id}','local','${policy}','${session}','${run}','${operation}','${attempt}','${hash}',${amount});`;
}

before(() => {
  assert.match(dockerShell('printf "%s|%s" "$POSTGRES_USER" "$POSTGRES_DB"'), /^.+\|.+$/);
  createDatabase(database);
  psql(m2Up);
  psql(m3Up);
  psql(m3Up);
});
after(() => dropDatabase(database));

test("M3 empty/repeat apply exposes explicit tables, checks, foreign keys, and indexes", () => {
  assert.equal(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'synthetic_%' OR table_name IN ('safety_controls','acp_checkout_documents'));"), "6");
  const constraints = Number(psql("SELECT count(*) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relname IN ('safety_controls','synthetic_budget_policies','synthetic_budget_counters','synthetic_admission_decisions','synthetic_reconciliation_controls','acp_checkout_documents');"));
  assert.ok(constraints >= 25, String(constraints));
  const indexes = psql("SELECT string_agg(indexname,',' ORDER BY indexname) FROM pg_indexes WHERE tablename LIKE 'synthetic_%' OR tablename IN ('safety_controls','acp_checkout_documents');");
  for (const name of ["synthetic_budget_policies_scope_idx","synthetic_admission_decisions_run_idx","synthetic_reconciliation_controls_due_idx","acp_checkout_documents_owner_idx"]) assert.match(indexes, new RegExp(name));
  assert.equal(psql("SELECT data_type FROM information_schema.columns WHERE table_name='synthetic_budget_policies' AND column_name='maximum_amount_minor';"), "bigint");
  assert.equal(psql("SELECT data_type FROM information_schema.columns WHERE table_name='synthetic_budget_policies' AND column_name='window_starts_at';"), "timestamp with time zone");
});

test("M3 down/reapply affects only additive M3 objects in a disposable database", () => {
  const rehearsal = `${database}_rollback`;
  createDatabase(rehearsal);
  try {
    psql(m2Up, rehearsal); psql(m3Up, rehearsal); psql(m3Down, rehearsal);
    assert.equal(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'synthetic_%' OR table_name IN ('safety_controls','acp_checkout_documents'));", rehearsal), "0");
    assert.equal(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='runs';", rehearsal), "1");
    psql(m3Up, rehearsal);
    assert.equal(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'synthetic_%' OR table_name IN ('safety_controls','acp_checkout_documents'));", rehearsal), "6");
  } finally { dropDatabase(rehearsal); }
});

test("missing control is disabled and optimistic control versions conflict", () => {
  seedRun("control");
  assert.equal(JSON.parse(psql(claimSql({ id: "control_a1", policy: "missing", session: "control_s", run: "control_r", operation: "control_op1", attempt: "control_at1" }))).status, "kill_switch");
  assert.equal(psql("INSERT INTO safety_controls(environment,payment_admission_enabled,reason_code) VALUES ('versioned',false,'initial') RETURNING version;"), "1");
  assert.equal(psql("UPDATE safety_controls SET payment_admission_enabled=true,version=version+1,reason_code='enabled' WHERE environment='versioned' AND version=1 RETURNING version;"), "2");
  assert.equal(psql("UPDATE safety_controls SET payment_admission_enabled=false,version=version+1,reason_code='stale' WHERE environment='versioned' AND version=1 RETURNING version;"), "");
});

test("concurrent reservations never exceed count or amount ceilings", async () => {
  seedRun("budget");
  psql(`INSERT INTO safety_controls(environment,payment_admission_enabled,reason_code) VALUES ('local',true,'local_test');
    INSERT INTO synthetic_budget_policies(id,environment,scope_type,session_id,run_id,maximum_amount_minor,attempt_ceiling,window_starts_at,window_ends_at,enabled)
      VALUES ('count_policy','local','run','budget_s','budget_r',1000,3,now()-interval '1 minute',now()+interval '1 hour',true),
             ('amount_policy','local','run','budget_s','budget_r',50,10,now()-interval '1 minute',now()+interval '1 hour',true);`);
  const countResults = await Promise.all(Array.from({ length: 10 }, (_, index) => psqlAsync(claimSql({
    id: `count_a${index}`, policy: "count_policy", session: "budget_s", run: "budget_r", operation: `count_op${index}`, attempt: `count_at${index}`, amount: 100,
  }))));
  assert.equal(countResults.map(JSON.parse).filter((item) => item.status === "reserved").length, 3);
  assert.equal(psql("SELECT consumed_attempt_count||'|'||consumed_amount_minor FROM synthetic_budget_counters WHERE policy_id='count_policy';"), "3|300");
  const amountResults = await Promise.all(Array.from({ length: 4 }, (_, index) => psqlAsync(claimSql({
    id: `amount_a${index}`, policy: "amount_policy", session: "budget_s", run: "budget_r", operation: `amount_op${index}`, attempt: `amount_at${index}`, amount: 30,
  }))));
  assert.equal(amountResults.map(JSON.parse).filter((item) => item.status === "reserved").length, 1);
  assert.equal(psql("SELECT consumed_attempt_count||'|'||consumed_amount_minor FROM synthetic_budget_counters WHERE policy_id='amount_policy';"), "1|30");
});

test("stable decisions replay safely while changed input conflicts without consuming twice", () => {
  const denied = claimSql({ id: "replay_a1", policy: "count_policy", session: "budget_s", run: "budget_r", operation: "replay_op", attempt: "replay_at", hash: "hash_a", amount: 10 });
  assert.equal(JSON.parse(psql(denied)).status, "budget_exhausted");
  assert.equal(JSON.parse(psql(denied)).status, "budget_exhausted");
  assert.equal(JSON.parse(psql(claimSql({ id: "replay_a2", policy: "count_policy", session: "budget_s", run: "budget_r", operation: "replay_op", attempt: "replay_at", hash: "hash_b", amount: 10 }))).status, "conflict");
  const reserved = claimSql({ id: "replay_reserved", policy: "amount_policy", session: "budget_s", run: "budget_r", operation: "replay_reserved_op", attempt: "replay_reserved_at", hash: "hash_c", amount: 10 });
  assert.equal(JSON.parse(psql(reserved)).status, "reserved");
  assert.equal(JSON.parse(psql(reserved)).status, "replay");
  assert.equal(psql("SELECT consumed_attempt_count||'|'||consumed_amount_minor FROM synthetic_budget_counters WHERE policy_id='amount_policy';"), "2|40");
});

test("budget counter and admission decision roll back atomically", () => {
  seedRun("atomic");
  psql(`UPDATE safety_controls SET payment_admission_enabled=true,version=version+1,reason_code='LOCAL_TEST' WHERE environment='local';
    INSERT INTO synthetic_budget_policies(id,environment,scope_type,session_id,run_id,maximum_amount_minor,attempt_ceiling,window_starts_at,window_ends_at,enabled)
      VALUES ('atomic_policy','local','run','atomic_s','atomic_r',100,1,now()-interval '1 minute',now()+interval '1 hour',true);`);
  psql(`BEGIN;
    ${claimSql({ id: "atomic_a", policy: "atomic_policy", session: "atomic_s", run: "atomic_r", operation: "atomic_op", attempt: "atomic_at", amount: 100 })}
    ROLLBACK;`);
  assert.equal(psql("SELECT count(*) FROM synthetic_admission_decisions WHERE id='atomic_a';"), "0");
  assert.equal(psql("SELECT count(*) FROM synthetic_budget_counters WHERE policy_id='atomic_policy';"), "0");
});

test("kill switch blocks new admission while existing reconciliation remains operable", () => {
  seedRun("recon");
  psql(`INSERT INTO checkouts(id,session_id,run_id,acp_version,state,cart_hash) VALUES ('recon_c','recon_s','recon_r','2026-04-17','ready','cart');
    INSERT INTO mandates(id,session_id,run_id,checkout_id,version,state,approved_text,constraints,currency,maximum_amount_minor,expires_at)
      VALUES ('recon_m','recon_s','recon_r','recon_c',1,'reserved','approved','{}','USD',100,now()+interval '1 hour');
    INSERT INTO orders(id,session_id,run_id,checkout_id,state,currency,amount_minor) VALUES ('recon_o','recon_s','recon_r','recon_c','pending_payment','USD',100);
    INSERT INTO payments(id,session_id,run_id,checkout_id,order_id,currency,amount_minor) VALUES ('recon_p','recon_s','recon_r','recon_c','recon_o','USD',100);
    INSERT INTO payment_attempts(id,session_id,run_id,checkout_id,payment_id,mandate_id,operation_key,request_hash,state)
      VALUES ('recon_at','recon_s','recon_r','recon_c','recon_p','recon_m','recon_op','hash','unknown');
    INSERT INTO synthetic_reconciliation_controls(id,session_id,run_id,attempt_id,state) VALUES ('recon_job','recon_s','recon_r','recon_at','pending');
    UPDATE safety_controls SET payment_admission_enabled=false,version=version+1,reason_code='operator_stop' WHERE environment='local';`);
  assert.equal(JSON.parse(psql(claimSql({ id: "recon_a", policy: "count_policy", session: "recon_s", run: "recon_r", operation: "new_op", attempt: "new_at" }))).status, "kill_switch");
  assert.equal(psql("UPDATE synthetic_reconciliation_controls SET state='resolved',version=version+1,last_result_code='synthetic_final' WHERE session_id='recon_s' AND run_id='recon_r' AND attempt_id='recon_at' RETURNING state;"), "resolved");
});

test("ACP checkout create/read/update/cancel remains session and run scoped", () => {
  seedRun("acpa"); seedRun("acpb");
  psql("INSERT INTO checkouts(id,session_id,run_id,acp_version,state,cart_hash) VALUES ('acp_c','acpa_s','acpa_r','2026-04-17','draft','hash_1');");
  psql(`INSERT INTO acp_checkout_documents(checkout_id,subject,session_id,run_id,document)
    VALUES ('acp_c','agent_a','acpa_s','acpa_r','{"id":"acp_c","status":"ready_for_payment"}');`);
  assert.equal(psql("SELECT count(*) FROM checkouts WHERE id='acp_c' AND session_id='acpb_s' AND run_id='acpb_r';"), "0");
  assert.equal(psql("UPDATE checkouts SET cart_hash='hash_2',cart_version=cart_version+1 WHERE id='acp_c' AND session_id='acpb_s' AND run_id='acpb_r' RETURNING id;"), "");
  assert.equal(psql("SELECT count(*) FROM acp_checkout_documents WHERE checkout_id='acp_c' AND subject='agent_b' AND session_id='acpa_s' AND run_id='acpa_r';"), "0");
  assert.equal(psql("UPDATE checkouts SET state='canceled',cart_version=cart_version+1 WHERE id='acp_c' AND session_id='acpa_s' AND run_id='acpa_r' RETURNING state;"), "canceled");
  psqlFails("INSERT INTO checkouts(id,session_id,run_id,acp_version,state,cart_hash) VALUES ('acp_bad','acpa_s','acpb_r','2026-04-17','draft','hash');", /foreign key/);
});
