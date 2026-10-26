import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { buildTextPdf, SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO } from "../src/lib/pdf/text-pdf";

test("an uploaded pdf opens in the reader", async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), "read-e2e-pdf-"));
  const pdfPath = path.join(dir, "sample.pdf");
  await writeFile(pdfPath, buildTextPdf([SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO]));

  await page.goto("/");
  await page.getByTestId("upload-pdf").setInputFiles(pdfPath);

  await expect(page.getByTestId("pdf-canvas")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("pdf-text-layer")).toContainText(SAMPLE_PAGE_ONE, {
    timeout: 20_000,
  });
  await expect(page.getByTestId("reader-current-page")).toHaveText("1");
});
