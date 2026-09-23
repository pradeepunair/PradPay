import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { executeStripeSpikeGuardCore } from "./guard-core.mjs";
import { createHostClockCapture } from "./host-clock.mjs";
import { FROZEN_REQUEST_HASH, FROZEN_SPIKE_REQUEST } from "./request.mjs";
import { sendApprovedStripeGrantedTokenRequest } from "./stripe-transport.mjs";
import { sanitizeExecutionFailure } from "./safe-errors.mjs";

export const CANONICAL_SPIKE_STATE_DIRECTORY = join(
  homedir(),
  ".paymentlab",
  "m3-stripe-spike-guard",
  FROZEN_REQUEST_HASH,
);

function exactInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("execution input is required");
  const keys = Object.keys(input).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["approval", "getCredential"])) {
    throw new Error("execution input fields do not match the approved production boundary");
  }
}

export async function executeApprovedStripeCapabilitySpike(input) {
  try {
    exactInput(input);
    if (typeof input.getCredential !== "function") throw new TypeError("approved credential adapter is required");
    await mkdir(CANONICAL_SPIKE_STATE_DIRECTORY, { recursive: true, mode: 0o700 });
    return await executeStripeSpikeGuardCore({
      request: FROZEN_SPIKE_REQUEST,
      approval: input.approval,
      stateDirectory: CANONICAL_SPIKE_STATE_DIRECTORY,
      captureClock: createHostClockCapture(),
      getCredential: input.getCredential,
      sendRequest: sendApprovedStripeGrantedTokenRequest,
    });
  } catch (error) {
    throw sanitizeExecutionFailure(error);
  }
}
