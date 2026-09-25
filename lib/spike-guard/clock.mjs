export const OUTER_START_EPOCH = 1790220900;
export const OUTER_END_EPOCH = 1790228100;
export const MAX_CLOCK_OFFSET_SECONDS = 1;
export const MAX_CLOCK_EVIDENCE_AGE_SECONDS = 60;
export const APPROVED_NTP_COMMAND = Object.freeze(["sntp", "-d", "time.apple.com"]);

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer`);
  return value;
}

function exactCommand(command) {
  return Array.isArray(command)
    && command.length === APPROVED_NTP_COMMAND.length
    && command.every((part, index) => part === APPROVED_NTP_COMMAND[index]);
}

function parseSelectedField(block, field) {
  const matches = [...block.matchAll(new RegExp(`^\\s*${field}:\\s*(.+)$`, "gm"))];
  if (matches.length !== 1) throw new Error(`selected NTP sample has invalid ${field}`);
  return matches[0][1].trim();
}

export function parseSntpSample({ command, output, exitCode, observedAtEpoch, nowEpoch } = {}) {
  if (!exactCommand(command)) throw new Error("NTP command or target is not approved");
  if (exitCode !== 0) throw new Error("NTP command did not succeed");
  if (typeof output !== "string" || output.length === 0) throw new Error("NTP output is missing");
  requireInteger(observedAtEpoch, "NTP observation epoch");
  requireInteger(nowEpoch, "current epoch");

  const selected = [...output.matchAll(/(?:^|\n)selected:\s*\nsntp_exchange\s*\{([\s\S]*?)\n\}/g)];
  if (selected.length !== 1) throw new Error("NTP output must contain exactly one selected sample");
  const block = selected[0][1];
  if (parseSelectedField(block, "result") !== "0 (Success)") throw new Error("selected NTP sample did not succeed");

  const offsetField = parseSelectedField(block, "offset");
  const offsetMatch = offsetField.match(/\(([+-]?(?:\d+(?:\.\d+)?|\.\d+))\)$/);
  if (!offsetMatch) throw new Error("selected NTP offset is not numeric");
  const offsetSeconds = Number(offsetMatch[1]);
  if (!Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) > MAX_CLOCK_OFFSET_SECONDS) {
    throw new Error("selected NTP offset exceeds the approved limit");
  }

  const summaryPattern = /^([+-](?:\d+(?:\.\d+)?|\.\d+))\s+\+\/-\s+((?:\d+(?:\.\d+)?|\.\d+))\s+(\S+)\s+\S+\s*$/gm;
  const summaries = [...output.matchAll(summaryPattern)];
  if (summaries.length !== 1) throw new Error("NTP output must contain exactly one peer summary");
  const summaryOffset = Number(summaries[0][1]);
  const uncertaintySeconds = Number(summaries[0][2]);
  const target = summaries[0][3];
  if (target !== "time.apple.com") throw new Error("NTP selected target is not approved");
  if (!Number.isFinite(summaryOffset) || !Number.isFinite(uncertaintySeconds) || uncertaintySeconds < 0) {
    throw new Error("NTP selected summary is invalid");
  }
  if (Math.abs(summaryOffset - offsetSeconds) > 0.000001) throw new Error("NTP selected offset and summary disagree");

  const ageSeconds = nowEpoch - observedAtEpoch;
  if (ageSeconds < 0 || ageSeconds > MAX_CLOCK_EVIDENCE_AGE_SECONDS) {
    throw new Error("NTP evidence is outside the approved freshness window");
  }

  return Object.freeze({ target, offsetSeconds, uncertaintySeconds, observedAtEpoch, nowEpoch, ageSeconds });
}

export function assertExecutionEpoch(epoch) {
  requireInteger(epoch, "execution epoch");
  if (epoch < OUTER_START_EPOCH || epoch >= OUTER_END_EPOCH) {
    throw new Error("execution epoch is outside the approved outer window");
  }
  return epoch;
}
