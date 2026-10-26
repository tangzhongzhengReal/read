import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const banned = [
  ["fonts.", "googleapis.com"].join(""),
  ["fonts.", "gstatic.com"].join(""),
  ["unpkg.", "com"].join(""),
  ["jsdelivr.", "net"].join(""),
  ["cdnjs.", "cloudflare.com"].join(""),
  ["esm.", "sh"].join(""),
  ["next/font/", "google"].join(""),
];

const skipDirs = new Set([
  "node_modules",
  ".next",
  "out",
  "release",
  "coverage",
  "e2e-runtime",
  ".git",
  "playwright-report",
  "test-results",
  "standard_fonts",
]);

function walk(dir: string, hits: string[]) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry) || entry === "pdf.worker.min.mjs") continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, hits);
      continue;
    }
    if (!/\.(?:ts|tsx|js|mjs|css|html|md|yml|yaml|sh)$/.test(entry)) continue;
    if (entry === "package-lock.json") continue;
    const text = readFileSync(full, "utf8");
    for (const needle of banned) {
      if (text.includes(needle)) hits.push(`${full} contains ${needle}`);
    }
  }
}

test("the app does not reference blocked font or script CDNs", () => {
  const hits: string[] = [];
  walk(process.cwd(), hits);
  expect(hits).toEqual([]);
});
