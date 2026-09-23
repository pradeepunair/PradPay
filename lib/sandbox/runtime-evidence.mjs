const CHECK_NAMES = Object.freeze(["build", "database", "callback", "worker", "migration", "killSwitch"]);
const STATES = new Set(["ready", "blocked", "unknown"]);
const SHA = /^[a-f0-9]{40}$/;
const SAFE_REASON = /^[A-Z][A-Z0-9_]{0,63}$/;

export class RuntimeEvidenceError extends Error {
  constructor(code) {
    super("Runtime evidence is invalid.");
    this.name = "RuntimeEvidenceError";
    this.code = code;
  }
}

function validateCheck(check) {
  if (!check || typeof check !== "object" || Array.isArray(check)) {
    throw new RuntimeEvidenceError("INVALID_CHECK");
  }
  if (!STATES.has(check.status)) throw new RuntimeEvidenceError("INVALID_CHECK_STATUS");
  const allowed = new Set(["status", "reason"]);
  if (Object.keys(check).some((key) => !allowed.has(key))) {
    throw new RuntimeEvidenceError("UNSAFE_CHECK_FIELDS");
  }
  if (check.reason !== undefined && (typeof check.reason !== "string" || !SAFE_REASON.test(check.reason))) {
    throw new RuntimeEvidenceError("UNSAFE_CHECK_REASON");
  }
  return Object.freeze({ status: check.status, ...(check.reason ? { reason: check.reason } : {}) });
}

export function createRuntimeEvidence({ commit, environment, checks, generatedAt }) {
  if (typeof commit !== "string" || !SHA.test(commit)) throw new RuntimeEvidenceError("INVALID_COMMIT");
  if (environment !== "staging" && environment !== "local") throw new RuntimeEvidenceError("INVALID_ENVIRONMENT");
  if (typeof generatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt)
    || Number.isNaN(Date.parse(generatedAt))) throw new RuntimeEvidenceError("INVALID_TIMESTAMP");
  if (!checks || typeof checks !== "object" || Array.isArray(checks)
    || Object.keys(checks).length !== CHECK_NAMES.length
    || CHECK_NAMES.some((name) => !(name in checks))) throw new RuntimeEvidenceError("INCOMPLETE_CHECKS");

  const safeChecks = Object.freeze(Object.fromEntries(CHECK_NAMES.map((name) => [name, validateCheck(checks[name])] )));
  const ready = Object.values(safeChecks).every(({ status }) => status === "ready");
  return Object.freeze({
    schemaVersion: 1,
    commit,
    environment,
    generatedAt,
    status: ready ? "READY" : "BLOCKED",
    checks: safeChecks,
  });
}

export function summarizeRuntimeEvidence(evidence) {
  if (!evidence || !Object.isFrozen(evidence) || evidence.schemaVersion !== 1) {
    throw new RuntimeEvidenceError("UNVALIDATED_EVIDENCE");
  }
  return Object.freeze({
    event: "sandbox.runtime_readiness",
    status: evidence.status,
    environment: evidence.environment,
    commit: evidence.commit,
    checkCounts: Object.freeze(Object.fromEntries(["ready", "blocked", "unknown"].map((state) => [
      state,
      Object.values(evidence.checks).filter((check) => check.status === state).length,
    ]))),
  });
}

export const RUNTIME_CHECKS = CHECK_NAMES;
