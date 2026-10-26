import path from "node:path";
import { expect, test } from "@playwright/test";

test("a tuple-path epub opens instead of spinning on layout", async ({ page }) => {
  const epubPath = path.join(process.cwd(), "fixtures/epub/malformed-tuple-paths.epub");

  await page.goto("/");
  await page.getByTestId("upload-epub").setInputFiles(epubPath);

  const next = page.getByRole("button", { name: "下一页" });
  await expect(next).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByTestId("epub-loading")).toHaveCount(0);
  await expect(page.getByTestId("reader-error")).toHaveCount(0);

  const chapter = page.frameLocator('[data-testid="epub-viewer"] iframe').locator("body");
  await next.click();
  await expect(chapter).toContainText("版权信息", { timeout: 15_000 });
  await expect(chapter).toContainText("安定此心");
});
