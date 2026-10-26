/**
 * @vitest-environment jsdom
 */
import ePub from "epubjs";
import { expect, test } from "vitest";
import {
  buildTextEpub,
  SAMPLE_EPUB_CHAPTER_ONE,
  SAMPLE_EPUB_CHAPTER_TWO,
} from "./text-epub";

test("sample epub is a stored zip whose first entry is the epub mimetype", () => {
  const bytes = buildTextEpub([SAMPLE_EPUB_CHAPTER_ONE, SAMPLE_EPUB_CHAPTER_TWO]);
  expect(Buffer.from(bytes.subarray(0, 2)).toString("utf8")).toBe("PK");

  const mimetype = readStoredEntry(bytes, "mimetype");
  expect(mimetype).toBe("application/epub+zip");
  expect(readStoredEntry(bytes, "META-INF/container.xml")).toContain("OEBPS/content.opf");
  expect(readStoredEntry(bytes, "OEBPS/chapter1.xhtml")).toContain(SAMPLE_EPUB_CHAPTER_ONE);
  expect(readStoredEntry(bytes, "OEBPS/chapter2.xhtml")).toContain(SAMPLE_EPUB_CHAPTER_TWO);
});

test("epub.js can read each chapter of the sample epub", async () => {
  const bytes = buildTextEpub([SAMPLE_EPUB_CHAPTER_ONE, SAMPLE_EPUB_CHAPTER_TWO]);
  const book = ePub(toArrayBuffer(bytes), { replacements: "none" });
  await book.opened;

  const first = book.spine.get(0);
  const second = book.spine.get(1);
  if (!first || !second) throw new Error("sample epub is missing a chapter");

  await first.load(book.load.bind(book));
  await second.load(book.load.bind(book));
  expect(textOf(first.document)).toContain(SAMPLE_EPUB_CHAPTER_ONE);
  expect(textOf(second.document)).toContain(SAMPLE_EPUB_CHAPTER_TWO);
  expect(textOf(first.document)).not.toContain(SAMPLE_EPUB_CHAPTER_TWO);

  book.destroy();
});

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function textOf(document: Document | undefined): string {
  return document?.documentElement?.textContent ?? "";
}

function readStoredEntry(bytes: Uint8Array, name: string): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.byteLength) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const entryName = Buffer.from(bytes.subarray(nameStart, nameStart + nameLength)).toString("utf8");
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + size;
    if (entryName === name) {
      if (method !== 0) throw new Error(`${name} is compressed`);
      return Buffer.from(bytes.subarray(dataStart, dataEnd)).toString("utf8");
    }
    offset = dataEnd;
  }
  throw new Error(`missing zip entry ${name}`);
}
