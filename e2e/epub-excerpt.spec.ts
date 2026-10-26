import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  buildTextEpub,
  SAMPLE_EPUB_CHAPTER_ONE,
  SAMPLE_EPUB_CHAPTER_TWO,
} from "../src/lib/epub/text-epub";

test("selecting epub text creates an excerpt card that jumps back", async ({ page }) => {
  const dir = await mkdtemp(path.join(tmpdir(), "read-e2e-epub-excerpt-"));
  const epubPath = path.join(dir, "sample.epub");
  await writeFile(epubPath, buildTextEpub([SAMPLE_EPUB_CHAPTER_ONE, SAMPLE_EPUB_CHAPTER_TWO]));

  await page.goto("/");
  await page.getByTestId("upload-epub").setInputFiles(epubPath);

  const chapter = () => page.frameLocator('[data-testid="epub-viewer"] iframe').locator("body");
  await expect(chapter()).toContainText(SAMPLE_EPUB_CHAPTER_ONE, { timeout: 20_000 });

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(chapter()).toContainText(SAMPLE_EPUB_CHAPTER_TWO, { timeout: 20_000 });
  await expect(chapter()).not.toContainText(SAMPLE_EPUB_CHAPTER_ONE);

  await chapter().locator("p").selectText();
  await page.getByTestId("create-excerpt").click();

  const card = page.getByTestId("excerpt-card");
  await expect(card).toContainText(SAMPLE_EPUB_CHAPTER_TWO);

  await page.getByRole("button", { name: "上一页" }).click();
  await expect(chapter()).toContainText(SAMPLE_EPUB_CHAPTER_ONE, { timeout: 20_000 });
  await expect(chapter()).not.toContainText(SAMPLE_EPUB_CHAPTER_TWO);

  await card.click();
  await expect(chapter()).toContainText(SAMPLE_EPUB_CHAPTER_TWO, { timeout: 20_000 });
  await expect(page.getByTestId("epub-highlight")).toBeVisible();
});
