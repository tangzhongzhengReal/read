/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ePub from "epubjs";
import { expect, test } from "vitest";
import { isEpubUpload } from "./epub-file";
import {
  normalizeTuplePath,
  sanitizeEpubArchive,
  stripMissingStylesheets,
} from "./sanitize-archive";
import { buildTextEpub, SAMPLE_EPUB_CHAPTER_ONE } from "./text-epub";

const fixturePath = path.join(process.cwd(), "fixtures/epub/malformed-tuple-paths.epub");

test("tuple paths collapse to the filename a buggy exporter wrapped", () => {
  expect(normalizeTuplePath("OEBPS/('chapter0.xhtml',)")).toBe("OEBPS/chapter0.xhtml");
  expect(normalizeTuplePath("href=\"('chapter10.xhtml',)\"")).toBe("href=\"chapter10.xhtml\"");
  expect(normalizeTuplePath('src=("cover.jpg",)')).toBe("src=cover.jpg");
});

test("missing stylesheets are dropped and stylesheets in the archive stay", () => {
  const archived = new Set(["OEBPS/styles.css"]);
  const xhtml = `<head>
    <link href="../Styles/stylesheets.css" rel="stylesheet" type="text/css"/>
    <link rel="stylesheet" href="styles.css"/>
    <link rel="prev" href="chapter1.xhtml"/>
  </head>`;

  const next = stripMissingStylesheets(xhtml, "OEBPS/chapter.xhtml", archived);

  expect(next).not.toContain("stylesheets.css");
  expect(next).toContain('href="styles.css"');
  expect(next).toContain('rel="prev"');
});

test("a normal epub is left untouched", async () => {
  const bytes = buildTextEpub([SAMPLE_EPUB_CHAPTER_ONE]);
  expect(await sanitizeEpubArchive(bytes)).toBe(bytes);
  expect(await sanitizeEpubArchive(new Uint8Array([1, 2, 3]))).toEqual(new Uint8Array([1, 2, 3]));
});

test("the tuple-path fixture is rewritten so epub.js can read the chapter text", async () => {
  const original = new Uint8Array(readFileSync(fixturePath));
  expect(isEpubUpload(original, { type: "", name: "malformed-tuple-paths.epub" })).toBe(true);
  expect(Buffer.from(original).includes("('chapter2.xhtml',)")).toBe(true);

  const sanitized = await sanitizeEpubArchive(original);
  const text = Buffer.from(sanitized).toString("latin1");
  expect(text.includes("('chapter")).toBe(false);
  expect(text.includes("stylesheets.css")).toBe(false);
  expect(text.includes("background_styles.css")).toBe(false);
  expect(text.includes("OEBPS/chapter2.xhtml")).toBe(true);
  expect(text.includes("af162ee424d63c87f7f7ec828031b134.jpg")).toBe(true);
  expect(Buffer.from(sanitized).includes("前言")).toBe(true);

  const book = ePub(toArrayBuffer(sanitized), { replacements: "none", openAs: "binary" });
  await book.ready;
  const section = book.spine.get("chapter2.xhtml");
  if (!section) throw new Error("sanitized spine is missing chapter2.xhtml");
  await section.load(book.load.bind(book));
  expect(section.document?.documentElement?.textContent ?? "").toContain("作为一名精神科医生");
  const cover = book.spine.get(0);
  if (!cover) throw new Error("sanitized spine is missing a cover");
  await cover.load(book.load.bind(book));
  expect(cover.document?.nodeType).toBe(9);
  book.destroy();
});

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}
