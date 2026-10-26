import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildTextPdf, SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO } from "./text-pdf";

const require = createRequire(import.meta.url);
GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

test("sample pdf text can be read back per page", async () => {
  const bytes = buildTextPdf([SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO]);
  expect(Buffer.from(bytes.subarray(0, 5)).toString("utf8")).toBe("%PDF-");

  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  expect(pdf.numPages).toBe(2);
  expect(await pageText(pdf, 1)).toContain(SAMPLE_PAGE_ONE);
  expect(await pageText(pdf, 2)).toContain(SAMPLE_PAGE_TWO);
});

async function pageText(pdf: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items.map((item) => ("str" in item ? item.str : "")).join("");
}
