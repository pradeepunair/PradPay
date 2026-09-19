function validateUnknownOperation(operation) {
  if (operation?.status !== "unknown" || !operation.operationId || !operation.attemptId) {
    throw new TypeError("Reconciliation requires an unknown operation with an existing attempt.");
  }
  if (!operation.sessionId || !operation.runId) {
    throw new TypeError("Reconciliation requires sessionId and runId ownership scope.");
  }
}

export function planUnknownOutcomeReconciliation(operation) {
  validateUnknownOperation(operation);
  return Object.freeze({
    action: "reconcile_existing_attempt",
    operationId: operation.operationId,
    attemptId: operation.attemptId,
    holdAuthority: true,
    createReplacementAttempt: false,
  });
}

export async function scheduleUnknownOutcomeReconciliation({ persistence, operation }) {
  validateUnknownOperation(operation);
  if (typeof persistence?.withTransaction !== "function"
    || typeof persistence?.createOutboxJob !== "function") {
    throw new TypeError("Reconciliation requires the transactional outbox persistence port.");
  }
  return persistence.withTransaction((tx) => persistence.createOutboxJob(tx, {
    type: "payment.reconcile_unknown",
    dedupeKey: `reconcile:${operation.attemptId}`,
    sessionId: operation.sessionId,
    runId: operation.runId,
    safePayload: {
      operationId: operation.operationId,
      attemptId: operation.attemptId,
      sessionId: operation.sessionId,
      runId: operation.runId,
    },
  }));
}
