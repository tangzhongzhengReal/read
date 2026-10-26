import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SERVER = "read.coming.js.cn";
const DEFAULT_UPSTREAM = "http://127.0.0.1:3210";

const KEPT_DIRECTIVE =
  /^(listen|server_name|http2|ssl_certificate|ssl_certificate_key|ssl_trusted_certificate|ssl_protocols|ssl_prefer_server_ciphers|ssl_ciphers|ssl_session_cache|ssl_session_timeout|ssl_stapling|ssl_stapling_verify|ssl_dhparam|add_header|access_log|error_log|client_max_body_size)\b/;

/**
 * Rewrite nginx server blocks for read.coming.js.cn from a static root
 * to a reverse proxy. Other sites and the HTTP redirect stay as they are.
 */
export function migrateNginxConfig(source, options = {}) {
  const serverName = options.serverName ?? DEFAULT_SERVER;
  const upstream = options.upstream ?? DEFAULT_UPSTREAM;
  const blocks = findServerBlocks(source);
  let config = source;
  let changed = false;

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (!block) continue;
    const text = config.slice(block.start, block.end);
    if (!shouldMigrate(text, serverName, upstream)) continue;
    config = config.slice(0, block.start) + renderProxyServer(text, upstream) + config.slice(block.end);
    changed = true;
  }

  return { config, changed };
}

function shouldMigrate(block, serverName, upstream) {
  if (!new RegExp(`server_name\\s+[^;]*\\b${escapeRegExp(serverName)}\\b`).test(block)) {
    return false;
  }
  if (block.includes(`proxy_pass ${upstream}`)) return false;
  return !isHttpRedirect(block);
}

function isHttpRedirect(block) {
  const listens = [...block.matchAll(/listen\s+([^;]+);/g)].map((match) => match[1] ?? "");
  const hasTls = listens.some((line) => /\b443\b/.test(line) || /\bssl\b/.test(line));
  return /return\s+301\b/.test(block) && !hasTls;
}

function renderProxyServer(block, upstream) {
  const inner = block.replace(/^\s*server\s*\{/, "").replace(/\}\s*$/, "");
  const kept = [];
  for (const raw of inner.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!KEPT_DIRECTIVE.test(line)) continue;
    kept.push(line.endsWith(";") ? line : `${line};`);
  }
  if (!kept.some((line) => line.startsWith("client_max_body_size"))) {
    kept.push("client_max_body_size 32m;");
  }

  return [
    "server {",
    ...kept.map((line) => `    ${line}`),
    "",
    "    location / {",
    `        proxy_pass ${upstream};`,
    "        proxy_http_version 1.1;",
    "        proxy_set_header Host $host;",
    "        proxy_set_header X-Real-IP $remote_addr;",
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    "        proxy_set_header X-Forwarded-Proto $scheme;",
    "    }",
    "}",
  ].join("\n");
}

function findServerBlocks(source) {
  const blocks = [];
  const pattern = /(^|[^\w-])server\s*\{/g;
  for (const match of source.matchAll(pattern)) {
    const keywordOffset = match[1] ? match[1].length : 0;
    const start = match.index + keywordOffset;
    const lineStart = source.lastIndexOf("\n", start) + 1;
    if (source.slice(lineStart, start).includes("#")) continue;
    const brace = source.indexOf("{", start);
    const close = matchingBrace(source, brace);
    if (close === -1) continue;
    blocks.push({ start, end: close + 1 });
  }
  return blocks;
}

function matchingBrace(source, openIndex) {
  let depth = 0;
  let quote = "";
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === "#") {
      const newline = source.indexOf("\n", index);
      index = newline === -1 ? source.length : newline;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node migrate-nginx-config.mjs <nginx-file>");
    process.exit(1);
  }
  const source = readFileSync(file, "utf8");
  const result = migrateNginxConfig(source);
  if (result.changed) writeFileSync(file, result.config);
  console.log(result.changed ? `updated ${file}` : `unchanged ${file}`);
}
