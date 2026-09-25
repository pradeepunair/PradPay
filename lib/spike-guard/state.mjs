import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { OUTER_END_EPOCH, OUTER_START_EPOCH, assertExecutionEpoch } from "./clock.mjs";
import { FROZEN_REQUEST_HASH } from "./request.mjs";

export const CLOCK_AUTHORITY = "ntp-corroborated-host-epoch";
export const APPROVED_APPROVAL_ID = "M3-STRIPE-CAP-SPIKE-001-PREP";
export const MAX_ACTION_LEASE_SECONDS = 600;

function requireInteger(value, name) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${name} must be a safe integer`);
  return value;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} is required`);
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw new Error(`${label} fields do not match the approved schema`);
}

export function createApprovalLease({ approval, nowEpoch } = {}) {
  exactKeys(approval, ["approvalId", "approvedAtEpoch", "durationSeconds", "clockAuthority", "outerStartEpoch", "outerEndEpoch", "requestHash"], "approval");
  assertExecutionEpoch(nowEpoch);
  requireInteger(approval.approvedAtEpoch, "approval epoch");
  requireInteger(approval.durationSeconds, "lease duration");
  if (approval.approvedAtEpoch !== nowEpoch) throw new Error("approval must be immediate and cannot be re-anchored");
  if (approval.durationSeconds < 1 || approval.durationSeconds > MAX_ACTION_LEASE_SECONDS) throw new Error("approval lease must be between 1 and 600 seconds");
  if (approval.clockAuthority !== CLOCK_AUTHORITY) throw new Error("clock authority mismatch");
  if (approval.outerStartEpoch !== OUTER_START_EPOCH || approval.outerEndEpoch !== OUTER_END_EPOCH) throw new Error("outer window mismatch");
  if (approval.requestHash !== FROZEN_REQUEST_HASH) throw new Error("request hash mismatch");
  if (approval.approvalId !== APPROVED_APPROVAL_ID) throw new Error("approval id does not match the approved package");

  return Object.freeze({
    approvalId: approval.approvalId,
    approvedAtEpoch: approval.approvedAtEpoch,
    startsAtEpoch: approval.approvedAtEpoch,
    endsAtEpoch: Math.min(approval.approvedAtEpoch + approval.durationSeconds, OUTER_END_EPOCH),
    requestHash: approval.requestHash,
    clockAuthority: approval.clockAuthority,
  });
}

export function assertActiveLease(lease, epoch) {
  exactKeys(lease, ["approvalId", "approvedAtEpoch", "startsAtEpoch", "endsAtEpoch", "requestHash", "clockAuthority"], "approval lease");
  if (!Object.isFrozen(lease)) throw new Error("approval lease must be immutable");
  requireInteger(epoch, "lease check epoch");
  if (lease.requestHash !== FROZEN_REQUEST_HASH || lease.clockAuthority !== CLOCK_AUTHORITY) throw new Error("approval lease mismatch");
  if (lease.approvedAtEpoch !== lease.startsAtEpoch) throw new Error("approval lease was re-anchored");
  requireInteger(lease.startsAtEpoch, "lease start");
  requireInteger(lease.endsAtEpoch, "lease end");
  if (lease.endsAtEpoch <= lease.startsAtEpoch || lease.endsAtEpoch > Math.min(lease.startsAtEpoch + MAX_ACTION_LEASE_SECONDS, OUTER_END_EPOCH)) {
    throw new Error("approval lease was extended or re-anchored");
  }
  if (epoch < lease.startsAtEpoch || epoch >= lease.endsAtEpoch) throw new Error("approval lease is not active");
  assertExecutionEpoch(epoch);
  return epoch;
}

async function durableWrite(path, content) {
  const file = await open(path, "wx", 0o600);
  try {
    await file.writeFile(content, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
}

async function syncDirectory(path) {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export function createFilesystemOneShot({ directory } = {}) {
  if (typeof directory !== "string" || !directory) throw new TypeError("state directory is required");
  const claimDirectory = join(directory, "stripe-spike-one-shot");
  const claimPath = join(claimDirectory, "claim.json");

  return Object.freeze({
    async claim({ lease, claimedAtEpoch } = {}) {
      assertActiveLease(lease, claimedAtEpoch);
      try {
        await mkdir(claimDirectory, { mode: 0o700 });
      } catch (error) {
        if (error?.code === "EEXIST") throw new Error("one-shot create request already consumed");
        throw error;
      }
      const record = Object.freeze({
        status: "consumed-before-dispatch",
        approvalId: lease.approvalId,
        approvedAtEpoch: lease.approvedAtEpoch,
        claimedAtEpoch,
        leaseEndsAtEpoch: lease.endsAtEpoch,
        requestHash: lease.requestHash,
        clockAuthority: lease.clockAuthority,
      });
      await syncDirectory(directory);
      await durableWrite(claimPath, `${JSON.stringify(record)}\n`);
      await syncDirectory(claimDirectory);
      return record;
    },
  });
}
