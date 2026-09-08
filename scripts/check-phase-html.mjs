#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const phasesDirectory = path.join(repositoryRoot, "docs", "phases");
const entries = await readdir(phasesDirectory);
const markdownFiles = entries
  .filter((name) => /^(?:phase-\d+-.+|PHASE-TEMPLATE)\.md$/.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
const phaseMarkdownFiles = markdownFiles.filter((name) => name.startsWith("phase-"));
const expectedHtmlFiles = [
  "index.html",
  ...markdownFiles.map((name) => name.replace(/\.md$/, ".html")),
];
const errors = [];

async function exists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

for (const htmlName of expectedHtmlFiles) {
  const htmlPath = path.join(phasesDirectory, htmlName);
  if (!(await exists(htmlPath))) {
    errors.push(`Missing generated HTML: ${htmlName}`);
    continue;
  }

  const html = await readFile(htmlPath, "utf8");
  const requiredPatterns = [
    [/^<!doctype html>/i, "HTML5 doctype"],
    [/<html lang="en">/i, "document language"],
    [/<meta name="viewport"/i, "responsive viewport"],
    [/<title>[^<]+<\/title>/i, "page title"],
    [/<nav aria-label="Phase navigation">/i, "labeled phase navigation"],
    [/<main>[\s\S]+<\/main>/i, "main content"],
    [/<footer>[\s\S]+<\/footer>/i, "generation footer"],
    [/npm run docs:phases/, "regeneration instruction"],
  ];
  for (const [pattern, label] of requiredPatterns) {
    if (!pattern.test(html)) errors.push(`${htmlName}: missing ${label}`);
  }

  if (/<script\b/i.test(html)) errors.push(`${htmlName}: generated page must not contain scripts`);
  if (/file:\/\//i.test(html)) errors.push(`${htmlName}: generated page contains a file URL`);
  if (/\[[^\]]+\]\([^)]+\)/.test(html)) errors.push(`${htmlName}: unresolved Markdown link`);

  for (const phaseMarkdownName of phaseMarkdownFiles) {
    const phaseHtmlName = phaseMarkdownName.replace(/\.md$/, ".html");
    if (!html.includes(`href="${phaseHtmlName}"`)) {
      errors.push(`${htmlName}: navigation is missing ${phaseHtmlName}`);
    }
  }

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1].split("#")[0];
    if (!href || /^(?:https?:|mailto:)/i.test(href)) continue;
    const target = path.resolve(phasesDirectory, decodeURIComponent(href));
    if (!(await exists(target))) errors.push(`${htmlName}: broken local link ${href}`);
  }
}

for (const markdownName of markdownFiles) {
  const htmlName = markdownName.replace(/\.md$/, ".html");
  if (!expectedHtmlFiles.includes(htmlName)) errors.push(`No HTML pair declared for ${markdownName}`);
}

if (phaseMarkdownFiles.length !== 6) {
  errors.push(`Expected six Phase 0-5 Markdown records; found ${phaseMarkdownFiles.length}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated six Markdown/HTML phase pairs, the template pair, navigation, structure, and local links.`);
