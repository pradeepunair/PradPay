import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ACP_CHECKOUT_OPERATIONS,
  assertPinnedAcpArtifacts,
  validateCheckoutCapability,
} from "../lib/acp/contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("pins the approved ACP checkout operation surface", () => {
  assert.deepEqual(ACP_CHECKOUT_OPERATIONS, [
    "POST /checkout_sessions",
    "GET /checkout_sessions/{checkout_session_id}",
    "POST /checkout_sessions/{checkout_session_id}",
    "POST /checkout_sessions/{checkout_session_id}/complete",
    "POST /checkout_sessions/{checkout_session_id}/cancel",
  ]);
});

test("vendored ACP artifacts match every manifest SHA-256", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "protocol/acp/manifest.json"), "utf8"));
  const results = await assertPinnedAcpArtifacts({ root, manifest });
  assert.equal(results.every((entry) => entry.valid), true);

  for (const artifact of manifest.artifacts) {
    const bytes = await readFile(path.join(root, "protocol/acp/upstream", artifact.path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), artifact.sha256);
  }
});

test("rejects a partial or repointed ACP manifest even when listed hashes are valid", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "protocol/acp/manifest.json"), "utf8"));
  await assert.rejects(
    () => assertPinnedAcpArtifacts({ root, manifest: { ...manifest, artifacts: manifest.artifacts.slice(0, -1) } }),
    /complete approved pin/,
  );
  await assert.rejects(
    () => assertPinnedAcpArtifacts({ root, manifest: { ...manifest, commit: "main" } }),
    /approved pin/,
  );
});

test("contract scaffold rejects unpinned versions and incomplete handlers", () => {
  assert.throws(
    () => validateCheckoutCapability({ protocol: { version: "main" }, capabilities: {} }),
    /2026-04-17/,
  );
  assert.throws(
    () =>
      validateCheckoutCapability({
        protocol: { version: "2026-04-17" },
        capabilities: { payment: { handlers: [{ id: "stripe" }] } },
      }),
    /handler field/,
  );
  assert.throws(
    () => validateCheckoutCapability({
      protocol: { version: "2026-04-17" },
      capabilities: { payment: { handlers: [] } },
    }),
    /at least one/,
  );
});

test("contract scaffold accepts an explicitly complete non-advertised test declaration", () => {
  const result = validateCheckoutCapability({
    protocol: { version: "2026-04-17" },
    capabilities: {
      payment: {
        handlers: [
          {
            id: "fixture-handler",
            name: "dev.paymentlab.fixture",
            version: "2026-04-17",
            spec: "https://example.invalid/payment-handler",
            requires_delegate_payment: false,
            requires_pci_compliance: false,
            psp: "fixture-only",
            config_schema: "https://example.invalid/config-schema",
            instrument_schemas: ["https://example.invalid/instrument-schema"],
            config: {},
          },
        ],
      },
    },
  });

  assert.equal(result.protocol.version, "2026-04-17");
});
