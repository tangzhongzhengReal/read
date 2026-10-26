const TUPLE_PATH = /\(\s*(['"])([^'"]+)\1\s*,\s*\)/g;
const TEXT_EXTENSIONS = new Set([
  "css",
  "htm",
  "html",
  "ncx",
  "opf",
  "svg",
  "txt",
  "xhtml",
  "xml",
]);

type ZipEntry = {
  name: string;
  method: number;
  flag: number;
  compressed: Uint8Array;
};

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export function normalizeTuplePath(value: string): string {
  return value.replace(new RegExp(TUPLE_PATH.source, "g"), (match, _quote, name: string) => {
    return name ? name : match;
  });
}

export function stripMissingStylesheets(
  markup: string,
  filePath: string,
  archivedPaths: ReadonlySet<string>,
): string {
  return markup.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!isStylesheet(tag)) return tag;
    const href = readAttribute(tag, "href");
    if (href == null || href.trim() === "") return tag;
    const resolved = resolveArchivePath(filePath, href);
    if (resolved && archivedPaths.has(resolved)) return tag;
    return "";
  });
}

// epub.js reads the extension from the last dot to the end of the filename.
// A Python 1-tuple name such as ('chapter0.xhtml',) is therefore not treated as
// XHTML. Section hooks throw, and rendition.display() never settles.
// Stylesheet links whose targets are absent from the zip are removed because
// the iframe load event waits on them.
export async function sanitizeEpubArchive(bytes: Uint8Array): Promise<Uint8Array> {
  const entries = readZipEntries(bytes);
  if (!entries) return bytes;
  try {
    const rewritten = await rewriteEntries(entries);
    if (!rewritten) return bytes;
    return writeStoredZip(rewritten);
  } catch {
    return bytes;
  }
}

async function rewriteEntries(
  entries: readonly ZipEntry[],
): Promise<Array<{ name: string; data: Uint8Array }> | null> {
  const used = new Set<string>();
  const finalNames: string[] = [];
  let namesChanged = false;
  for (const entry of entries) {
    let name = normalizeTuplePath(entry.name);
    if (used.has(name)) name = uniqueName(name, used);
    used.add(name);
    if (name !== entry.name) namesChanged = true;
    finalNames.push(name);
  }

  const archived = new Set(finalNames);
  const output: Array<{ name: string; data: Uint8Array }> = [];
  let contentChanged = false;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const name = finalNames[index] ?? entry.name;
    if ((entry.flag & 0x1) !== 0) throw new Error("encrypted zip entry");
    const raw = await inflateEntry(entry);
    if (!isTextPath(name)) {
      output.push({ name, data: raw });
      continue;
    }
    const text = textDecoder.decode(raw);
    const renamed = applyTupleRenames(text, entries, finalNames);
    const stripped = stripMissingStylesheets(renamed, name, archived);
    if (stripped !== text) contentChanged = true;
    output.push({ name, data: textEncoder.encode(stripped) });
  }

  if (!namesChanged && !contentChanged) return null;
  return output;
}

function applyTupleRenames(
  text: string,
  entries: readonly ZipEntry[],
  finalNames: readonly string[],
): string {
  let next = text;
  for (let index = 0; index < entries.length; index += 1) {
    const originalBase = baseName(entries[index]?.name ?? "");
    const finalBase = baseName(finalNames[index] ?? "");
    if (!originalBase || originalBase === finalBase) continue;
    if (!new RegExp(`^${TUPLE_PATH.source}$`).test(originalBase)) continue;
    next = next.replaceAll(originalBase, finalBase);
  }
  return next;
}

async function inflateEntry(entry: ZipEntry): Promise<Uint8Array> {
  if (entry.compressed.byteLength === 0) return new Uint8Array();
  if (entry.method === 0) return copyBytes(entry.compressed);
  if (entry.method === 8) return inflateRaw(entry.compressed);
  throw new Error("unsupported zip method");
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("cannot inflate zip");
  const input = new Uint8Array(new ArrayBuffer(compressed.byteLength));
  input.set(compressed);
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  const reading = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  })();
  await writer.write(input);
  await writer.close();
  await reading;
  return concat(chunks);
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] | null {
  if (bytes.byteLength < 22) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes);
  if (eocd < 0 || eocd + 22 > bytes.byteLength) return null;
  const count = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (directoryOffset === 0xffffffff || directoryOffset > bytes.byteLength) return null;

  const entries: ZipEntry[] = [];
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.byteLength) return null;
    if (view.getUint32(cursor, true) !== 0x02014b50) return null;
    const flag = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) return null;
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.byteLength) return null;
    const name = textDecoder.decode(bytes.subarray(nameStart, nameEnd));
    if (localOffset + 30 > bytes.byteLength) return null;
    if (view.getUint32(localOffset, true) !== 0x04034b50) return null;
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.byteLength) return null;
    entries.push({
      name,
      method,
      flag,
      compressed: bytes.subarray(dataStart, dataEnd),
    });
    cursor = nameEnd + extraLength + commentLength;
  }
  return entries;
}

function writeStoredZip(entries: readonly { name: string; data: Uint8Array }[]): Uint8Array {
  const ordered = [...entries].sort((left, right) => {
    if (left.name === "mimetype") return -1;
    if (right.name === "mimetype") return 1;
    return 0;
  });
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of ordered) {
    const nameBytes = textEncoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + nameBytes.length + entry.data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, ordered.length, true);
  endView.setUint16(10, ordered.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return concat([...localParts, ...centralParts, end]);
}

function findEocd(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.byteLength - 22 - 0xffff);
  for (let index = bytes.byteLength - 22; index >= start; index -= 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x05 &&
      bytes[index + 3] === 0x06
    ) {
      return index;
    }
  }
  return -1;
}

function isStylesheet(tag: string): boolean {
  const rel = readAttribute(tag, "rel");
  if (rel?.toLowerCase().split(/\s+/).includes("stylesheet")) return true;
  return readAttribute(tag, "type")?.toLowerCase() === "text/css";
}

function readAttribute(source: string, name: string): string | null {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "i",
  ).exec(source);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

function resolveArchivePath(fromFile: string, href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  const pathOnly = trimmed.split("#")[0]?.split("?")[0] ?? "";
  let decoded = pathOnly;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    decoded = pathOnly;
  }
  const stack = fromFile.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  const resolved = stack.join("/");
  return resolved || null;
}

function isTextPath(name: string): boolean {
  const extension = baseName(name).split(".").pop()?.toLowerCase() ?? "";
  if (!baseName(name).includes(".")) return false;
  return TEXT_EXTENSIONS.has(extension);
}

function baseName(name: string): string {
  const slash = name.lastIndexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

function uniqueName(name: string, used: ReadonlySet<string>): string {
  const slash = name.lastIndexOf("/");
  const directory = slash >= 0 ? name.slice(0, slash + 1) : "";
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : "";
  let suffix = 2;
  let candidate = `${directory}${stem}-${suffix}${extension}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${directory}${stem}-${suffix}${extension}`;
  }
  return candidate;
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
