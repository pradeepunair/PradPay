#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const phasesDirectory = path.join(repositoryRoot, "docs", "phases");
const checkOnly = process.argv.includes("--check");
const staleOutputs = [];

async function emitOutput(outputName, html) {
  const outputPath = path.join(phasesDirectory, outputName);
  if (!checkOnly) {
    await writeFile(outputPath, html);
    return;
  }

  let current;
  try {
    current = await readFile(outputPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      staleOutputs.push(`${outputName} (missing)`);
      return;
    }
    throw error;
  }

  if (current !== html) staleOutputs.push(outputName);
}

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function phaseHref(href, phaseSources) {
  if (/^(?:[a-z]+:|#|\/)/i.test(href)) return href;
  const [file, fragment = ""] = href.split("#");
  if (!phaseSources.has(file)) return href;
  return `${file.replace(/\.md$/i, ".html")}${fragment ? `#${fragment}` : ""}`;
}

function renderInline(value, phaseSources) {
  let rendered = escapeHtml(value);
  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const resolved = escapeHtml(phaseHref(href, phaseSources));
    const external = /^https?:/i.test(href) ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${resolved}"${external}>${label}</a>`;
  });
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  return rendered;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderMarkdown(markdown, phaseSources) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      const languageClass = language ? ` class="language-${escapeHtml(language)}"` : "";
      output.push(`<pre><code${languageClass}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const id = slug(heading[2]);
      output.push(`<h${level} id="${id}">${renderInline(heading[2], phaseSources)}</h${level}>`);
      index += 1;
      continue;
    }

    if (
      line.trim().startsWith("|") &&
      index + 1 < lines.length &&
      /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(lines[index + 1])
    ) {
      const headers = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      output.push(
        `<div class="table-wrap"><table><thead><tr>${headers
          .map((cell) => `<th>${renderInline(cell, phaseSources)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${headers
                .map((_header, cellIndex) => `<td>${renderInline(row[cellIndex] ?? "", phaseSources)}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table></div>`,
      );
      continue;
    }

    const listMatch = line.match(/^\s*(-|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*(-|\d+\.)\s+(.+)$/);
        if (!match || /\d+\./.test(match[1]) !== ordered) break;
        let content = match[2];
        let continuation = index + 1;
        while (
          continuation < lines.length &&
          /^\s{2,}\S/.test(lines[continuation]) &&
          !/^\s*(-|\d+\.)\s+/.test(lines[continuation])
        ) {
          content += ` ${lines[continuation].trim()}`;
          continuation += 1;
        }
        const checkbox = content.match(/^\[([ xX])\]\s+(.+)$/);
        if (checkbox) {
          const checked = checkbox[1].toLowerCase() === "x";
          items.push(
            `<li class="task"><input type="checkbox" disabled${checked ? " checked" : ""}>${renderInline(checkbox[2], phaseSources)}</li>`,
          );
        } else {
          items.push(`<li>${renderInline(content, phaseSources)}</li>`);
        }
        index = continuation;
      }
      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    if (line.startsWith("> ")) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      output.push(`<blockquote>${renderInline(quote.join(" "), phaseSources)}</blockquote>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !lines[index].startsWith("```") &&
      !/^\s*(-|\d+\.)\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith("|") &&
      !lines[index].startsWith("> ")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(" "), phaseSources)}</p>`);
  }

  return output.join("\n");
}

const styles = `
  :root { color-scheme: light; --ink:#162a3a; --muted:#5f7180; --line:#c9d7df; --paper:#fff; --wash:#eef6f7; --accent:#176b73; --accent-2:#dff3ee; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin:0; color:var(--ink); background:#f5f8f9; font:16px/1.62 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  a { color:#075e68; text-underline-offset:.16em; }
  .shell { max-width:1120px; margin:0 auto; padding:24px; }
  .topbar { display:flex; gap:16px; align-items:center; justify-content:space-between; flex-wrap:wrap; margin-bottom:18px; }
  .brand { font-weight:800; letter-spacing:.02em; text-decoration:none; color:var(--ink); }
  nav { display:flex; gap:8px; flex-wrap:wrap; }
  nav a { padding:7px 10px; border:1px solid var(--line); border-radius:999px; background:var(--paper); text-decoration:none; font-size:.88rem; }
  main { background:var(--paper); border:1px solid var(--line); border-radius:18px; padding:clamp(24px,5vw,60px); box-shadow:0 16px 50px rgba(27,61,73,.08); }
  h1,h2,h3,h4 { line-height:1.18; letter-spacing:-.02em; scroll-margin-top:20px; }
  h1 { font-size:clamp(2rem,5vw,3.6rem); max-width:20ch; margin-top:0; }
  h2 { margin-top:2.4em; padding-top:.5em; border-top:1px solid var(--line); }
  h3 { margin-top:1.8em; color:var(--accent); }
  p,li { max-width:82ch; }
  code { padding:.12em .32em; border-radius:5px; background:var(--wash); font-size:.92em; }
  pre { overflow:auto; padding:18px; border-radius:12px; color:#e8f4f4; background:#102a34; }
  pre code { padding:0; color:inherit; background:transparent; }
  .table-wrap { overflow-x:auto; margin:1.2rem 0; }
  table { width:100%; border-collapse:collapse; min-width:680px; }
  th,td { padding:10px 12px; border:1px solid var(--line); text-align:left; vertical-align:top; }
  th { background:var(--wash); font-size:.9rem; }
  .task { list-style:none; margin-left:-1.3rem; }
  input[type=checkbox] { margin-right:.65rem; accent-color:var(--accent); }
  blockquote { margin:1.2rem 0; padding:.3rem 1rem; border-left:4px solid var(--accent); background:var(--accent-2); }
  footer { padding:18px 4px 40px; color:var(--muted); font-size:.88rem; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:16px; }
  .card { padding:20px; border:1px solid var(--line); border-radius:14px; background:var(--paper); }
  .card h2 { border:0; margin:.2rem 0 .6rem; padding:0; font-size:1.2rem; }
  .status { color:var(--muted); font-size:.9rem; }
  @media (max-width:640px) { .shell { padding:12px; } main { border-radius:12px; padding:22px; } }
  @media print { body { background:#fff; } .shell { max-width:none; padding:0; } .topbar { display:none; } main { border:0; box-shadow:none; padding:0; } a { color:inherit; } }
`;

function page({ title, body, navigation, sourceName, description }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)} · PaymentLab AI</title>
  <style>${styles}</style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="index.html">PaymentLab AI · Phase documentation</a>
      <nav aria-label="Phase navigation">${navigation}</nav>
    </header>
    <main>${body}</main>
    <footer>Generated from <a href="${escapeHtml(sourceName)}">${escapeHtml(sourceName)}</a> by <code>npm run docs:phases</code>. Markdown is the editable source of truth.</footer>
  </div>
</body>
</html>
`;
}

await mkdir(phasesDirectory, { recursive: true });
const entries = await readdir(phasesDirectory);
const phaseFiles = entries
  .filter((name) => /^(?:phase-\d+-.+|PHASE-TEMPLATE)\.md$/.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
const phaseSources = new Set(phaseFiles);
phaseSources.add("README.md");
const documents = [];

for (const sourceName of phaseFiles) {
  const markdown = await readFile(path.join(phasesDirectory, sourceName), "utf8");
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? sourceName.replace(/\.md$/, "");
  const status = markdown.match(/^- Status:\s*(.+)$/m)?.[1] ?? "template";
  documents.push({ sourceName, title, status, markdown });
}

const phaseDocuments = documents.filter(({ sourceName }) => sourceName.startsWith("phase-"));
const navigation = [
  '<a href="index.html">Index</a>',
  ...phaseDocuments.map(({ sourceName, title }) => {
    const label = title.match(/^Phase\s+\d+/i)?.[0] ?? title;
    return `<a href="${sourceName.replace(/\.md$/, ".html")}">${escapeHtml(label)}</a>`;
  }),
].join("");

for (const document of documents) {
  const outputName = document.sourceName.replace(/\.md$/, ".html");
  const html = page({
    title: document.title,
    body: renderMarkdown(document.markdown, phaseSources),
    navigation,
    sourceName: document.sourceName,
    description: `${document.title}, generated from the maintained Markdown phase record.`,
  });
  await emitOutput(outputName, html);
}

const cards = phaseDocuments
  .map(
    ({ sourceName, title, status }) => `<article class="card">
      <p class="status">${renderInline(status, phaseSources)}</p>
      <h2><a href="${sourceName.replace(/\.md$/, ".html")}">${renderInline(title, phaseSources)}</a></h2>
      <a href="${sourceName}">Markdown source</a>
    </article>`,
  )
  .join("\n");
const indexMarkdown = await readFile(path.join(phasesDirectory, "README.md"), "utf8");
const indexIntroduction = indexMarkdown.split("The paired records are:")[0];
const indexBody = `${renderMarkdown(indexIntroduction, phaseSources)}
<div class="cards">${cards}</div>
<p><a href="PHASE-TEMPLATE.html">HTML phase template</a> · <a href="PHASE-TEMPLATE.md">Markdown phase template</a></p>`;
await emitOutput(
  "index.html",
  page({
    title: "Phase documentation",
    body: indexBody,
    navigation,
    sourceName: "README.md",
    description: "Index of PaymentLab AI phase records in Markdown and HTML.",
  }),
);

if (checkOnly && staleOutputs.length) {
  console.error(`Stale generated phase HTML:\n${staleOutputs.map((name) => `- ${name}`).join("\n")}`);
  console.error("Run npm run docs:phases and commit the generated output.");
  process.exit(1);
}

console.log(
  checkOnly
    ? `Verified ${documents.length} generated phase pages plus docs/phases/index.html are current.`
    : `Generated ${documents.length} phase pages plus docs/phases/index.html.`,
);
