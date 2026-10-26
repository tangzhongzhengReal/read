import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { buildTextPdf, SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO } from "../src/lib/pdf/text-pdf";

test("selecting text creates an excerpt card that jumps back", async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), "read-e2e-excerpt-"));
  const pdfPath = path.join(dir, "sample.pdf");
  await writeFile(pdfPath, buildTextPdf([SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO]));

  await page.goto("/");
  await page.getByTestId("upload-pdf").setInputFiles(pdfPath);
  await expect(page.getByTestId("pdf-text-layer")).toContainText(SAMPLE_PAGE_ONE, {
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("2");
  await expect(page.getByTestId("pdf-text-layer")).toContainText(SAMPLE_PAGE_TWO);

  await page
    .getByTestId("pdf-text-layer")
    .locator("span", { hasText: SAMPLE_PAGE_TWO })
    .selectText();
  await page.getByTestId("create-excerpt").click();

  const card = page.getByTestId("excerpt-card");
  await expect(card).toContainText(SAMPLE_PAGE_TWO);

  await page.getByRole("button", { name: "上一页" }).click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("1");
  await expect(page.getByTestId("pdf-text-layer")).toContainText(SAMPLE_PAGE_ONE);

  await card.click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("2");
  await expect(page.getByTestId("excerpt-highlight")).toBeVisible();
  await expect(page.getByTestId("pdf-text-layer")).toContainText(SAMPLE_PAGE_TWO);
});
