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
    claimSyntheticPaymentAttempt: dataPersistence.claimSyntheticPaymentAttempt.bind(dataPersistence),
    markPaymentAttemptUnknown: dataPersistence.markPaymentAttemptUnknown.bind(dataPersistence),
    readUnknownPaymentAttempt: dataPersistence.readUnknownPaymentAttempt.bind(dataPersistence),
    upsertReconciliationControl: dataPersistence.upsertReconciliationControl.bind(dataPersistence),
    readReconciliationControl: dataPersistence.readReconciliationControl.bind(dataPersistence),
    createOutboxJob: outboxPersistence.createOutboxJob.bind(outboxPersistence),
  });
}
