import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  buildTextEpub,
  SAMPLE_EPUB_CHAPTER_ONE,
  SAMPLE_EPUB_CHAPTER_TWO,
} from "../src/lib/epub/text-epub";

test("an uploaded epub opens in the reader", async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), "read-e2e-epub-"));
  const epubPath = path.join(dir, "sample.epub");
  await writeFile(epubPath, buildTextEpub([SAMPLE_EPUB_CHAPTER_ONE, SAMPLE_EPUB_CHAPTER_TWO]));

  await page.goto("/");
  await page.getByTestId("upload-epub").setInputFiles(epubPath);

  const chapter = page.frameLocator('[data-testid="epub-viewer"] iframe').locator("body");
  await expect(chapter).toContainText(SAMPLE_EPUB_CHAPTER_ONE, { timeout: 20_000 });
  await expect(page.getByTestId("epub-reader")).toBeVisible();
});
