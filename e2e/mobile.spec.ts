import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { buildTextPdf, SAMPLE_PAGE_ONE } from "../src/lib/pdf/text-pdf";

async function expectNoHorizontalOverflow(page: Page) {
  const extra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(extra).toBeLessThanOrEqual(1);
}

test("library, map, review, and reader fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const createBox = await page.getByTestId("create-workspace").boundingBox();
  expect(createBox?.height ?? 0).toBeGreaterThanOrEqual(40);

  await page.goto("/map");
  await expect(page.getByTestId("mind-canvas")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const touchAction = await page.locator(".react-flow__pane").evaluate((element) => {
    return getComputedStyle(element).touchAction;
  });
  expect(touchAction).toBe("none");

  await page.goto("/review");
  await expect(page.getByTestId("review-page")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/read");
  await expect(page.getByText("缺少文档")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const dir = await mkdtemp(path.join(tmpdir(), "read-e2e-mobile-"));
  const pdfPath = path.join(dir, "sample.pdf");
  await writeFile(pdfPath, buildTextPdf([SAMPLE_PAGE_ONE]));
  await page.goto("/");
  await page.getByTestId("upload-pdf").setInputFiles(pdfPath);
  await expect(page.getByTestId("pdf-text-layer")).toContainText(SAMPLE_PAGE_ONE, { timeout: 20_000 });
  await expectNoHorizontalOverflow(page);
  const pageBox = await page.getByTestId("pdf-page").boundingBox();
  expect(pageBox?.width ?? 999).toBeLessThanOrEqual(390);
});
