import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entrypoints = ["app/demo/[runId]/page.tsx", "components/replay-workspace.tsx"];
const bannedRuntime = /stripe-webhook|STRIPE_|\/api\/webhooks|fetch\s*\(|XMLHttpRequest|axios|prisma|postgres|use server|child_process/i;
const staticImportPattern = /(?:from\s+|import\s*)["']([^"']+)["']/g;
const dynamicImportPattern = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
const allowedExternal = /^(?:node:|react$|next\/)/;

function assertAllowedExternal(specifier, parent) {
  assert.match(specifier, allowedExternal, `unapproved external or aliased replay import ${specifier} from ${parent}`);
}

async function resolveLocalImport(parent, specifier) {
  if (!specifier.startsWith(".")) {
    assertAllowedExternal(specifier, path.relative(root, parent));
    return null;
  }
  const base = path.resolve(path.dirname(parent), specifier);
  const candidates = path.extname(base) ? [base] : [base, ...[".js", ".mjs", ".ts", ".tsx"].map((extension) => `${base}${extension}`)];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error(`Unable to resolve local replay import ${specifier} from ${parent}`);
}

async function collectDependencyGraph(relativeEntrypoints) {
  const pending = relativeEntrypoints.map((entrypoint) => path.join(root, entrypoint));
  const visited = new Set();
  while (pending.length) {
    const absolutePath = pending.pop();
    if (visited.has(absolutePath)) continue;
    visited.add(absolutePath);
    const source = await readFile(absolutePath, "utf8");
    assert.doesNotMatch(source, bannedRuntime, `live dependency marker found in ${path.relative(root, absolutePath)}`);
    if (absolutePath.endsWith(".css")) continue;
    const specifiers = [
      ...[...source.matchAll(staticImportPattern)].map((match) => match[1]),
      ...[...source.matchAll(dynamicImportPattern)].map((match) => match[1]),
    ];
    for (const specifier of specifiers) {
      const dependency = await resolveLocalImport(absolutePath, specifier);
      if (dependency) pending.push(dependency);
    }
  }
  return visited;
}

test("Guided Replay transitive dependency graph has no live adapter or mutation imports", async () => {
  const graph = await collectDependencyGraph(entrypoints);
  assert.equal([...graph].some((file) => file.endsWith("lib/replay/store.mjs")), true);
  assert.equal([...graph].some((file) => file.endsWith("lib/replay/reducer.mjs")), true);
});

test("replay isolation rejects unapproved packages and path aliases", () => {
  assert.throws(() => assertAllowedExternal("stripe", "fixture.ts"), /unapproved external/);
  assert.throws(() => assertAllowedExternal("@/lib/live-payment", "fixture.ts"), /unapproved external/);
  assert.doesNotThrow(() => assertAllowedExternal("react", "fixture.ts"));
});

test("synthetic recording contains no credential-shaped values", async () => {
  const source = await readFile(path.join(root, "public/replays/synthetic-success-v1.json"), "utf8");
  assert.doesNotMatch(source, /(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|spt_[A-Za-z0-9]+/);
});
