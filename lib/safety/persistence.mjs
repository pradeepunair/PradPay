function requireMethod(value, method, owner) {
  if (typeof value?.[method] !== "function") {
    throw new TypeError(`${owner} must implement ${method}().`);
  }
}

export function createLocalSafetyPersistence({ dataPersistence, outboxPersistence } = {}) {
  for (const method of [
    "withTransaction",
    "readSafetyControl",
    "reserveSyntheticBudget",
    "claimSyntheticPaymentAttempt",
    "markPaymentAttemptUnknown",
    "readUnknownPaymentAttempt",
    "upsertReconciliationControl",
    "readReconciliationControl",
    "createOutboxJob",
  ]) {
    requireMethod(dataPersistence, method, "dataPersistence");
  }
  requireMethod(outboxPersistence, "createOutboxJob", "outboxPersistence");

  return Object.freeze({
    withTransaction: dataPersistence.withTransaction.bind(dataPersistence),
    readSafetyControl: dataPersistence.readSafetyControl.bind(dataPersistence),
    reserveSyntheticBudget: dataPersistence.reserveSyntheticBudget.bind(dataPersistence),
    claimSyntheticPaymentAttempt: async (tx, scope) => {
      const raw = await dataPersistence.claimSyntheticPaymentAttempt(tx, scope);
      if (!raw || typeof raw !== "object") {
        throw new TypeError("claimSyntheticPaymentAttempt must return {status:'ready',attempt:<row>} or {status:'rejected'}");
      }
      if (raw.status !== "ready") {
        return raw;
      }
      if (!raw.attempt || typeof raw.attempt !== "object") {
        throw new TypeError("claimSyntheticPaymentAttempt ready response requires attempt object");
      }
      const attempt = raw.attempt;
      const hasCamelCase = typeof attempt.operationId === "string"
        && typeof attempt.requestHash === "string";
      if (hasCamelCase) {
        return raw;
      }
      // Dax PostgreSQL row fields: normalize to Riley's camelCase contract
      // only exact Dax shape {status:'ready',attempt:<row>} — reject malformed
      if (typeof attempt.session_id !== "string"
        || typeof attempt.run_id !== "string"
        || typeof attempt.operation_key !== "string"
        || typeof attempt.request_hash !== "string"
        || typeof attempt.state !== "string") {
        throw new TypeError("claimSyntheticPaymentAttempt malformed: missing Dax snake_case fields");
      }
      const normalized = {
        status: raw.status,
        attempt: {
          sessionId: attempt.session_id,
          runId: attempt.run_id,
          attemptId: attempt.attempt_id ?? scope.attemptId,
          operationId: attempt.operation_key,
          requestHash: attempt.request_hash,
          state: attempt.state,
          id: attempt.id,
        },
      };
      return normalized;
    },
    markPaymentAttemptUnknown: dataPersistence.markPaymentAttemptUnknown.bind(dataPersistence),
    readUnknownPaymentAttempt: dataPersistence.readUnknownPaymentAttempt.bind(dataPersistence),
    upsertReconciliationControl: dataPersistence.upsertReconciliationControl.bind(dataPersistence),
    readReconciliationControl: dataPersistence.readReconciliationControl.bind(dataPersistence),
    createOutboxJob: outboxPersistence.createOutboxJob.bind(outboxPersistence),
  });
}
