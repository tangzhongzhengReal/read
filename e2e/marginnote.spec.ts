import { mkdir } from "node:fs/promises";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  buildTextEpub,
  SAMPLE_EPUB_CHAPTER_ONE,
  SAMPLE_EPUB_CHAPTER_TWO,
} from "../src/lib/epub/text-epub";
import { buildTextPdf, SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO } from "../src/lib/pdf/text-pdf";

const shots = "/opt/cursor/artifacts/marginnote";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(shots, name), fullPage: false });
}

async function writePdf(pages: string[]) {
  const dir = await mkdtemp(path.join(tmpdir(), "read-e2e-mn-pdf-"));
  const pdfPath = path.join(dir, "sample.pdf");
  await writeFile(pdfPath, buildTextPdf(pages));
  return pdfPath;
}

async function writeEpub(chapters: string[]) {
  const dir = await mkdtemp(path.join(tmpdir(), "read-e2e-mn-epub-"));
  const epubPath = path.join(dir, "sample.epub");
  await writeFile(epubPath, buildTextEpub(chapters));
  return epubPath;
}

test.beforeAll(async () => {
  await mkdir(shots, { recursive: true });
});

test("library uses a sidebar and a cover grid with a blue import button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("library-sidebar")).toBeVisible();
  await expect(page.getByTestId("library-section-study")).toBeVisible();
  await expect(page.getByTestId("library-section-docs")).toBeVisible();
  await expect(page.getByTestId("library-section-review")).toBeVisible();
  await expect(page.getByTestId("library-section-docs")).toContainText("分类");
  await expect(page.getByTestId("library-section-docs")).toContainText("本地文件夹");
  await expect(page.getByTestId("open-study-set")).toHaveAttribute("href", "/w");

  const importPdf = page.locator("label", { has: page.getByTestId("upload-pdf") });
  await expect(importPdf).toHaveCSS("background-color", "rgb(72, 148, 243)");

  await page.getByRole("button", { name: "学习集库" }).click();
  const grid = page.getByTestId("library-grid");
  await expect(grid).toBeVisible();
  await expect(grid).toHaveCSS("display", "grid");
  await expect(grid).toContainText("本地");
  await shot(page, "library-desktop.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "library-phone.png");
});

test("study workspace splits, drags, collapses, and stacks on a phone", async ({ page }) => {
  await page.goto("/w");
  const workspace = page.getByTestId("study-workspace");
  await expect(workspace).toHaveAttribute("data-layout", "split");
  await expect(workspace).toHaveAttribute("data-link-mode", "both");
  await expect(page.getByTestId("mind-pane")).toBeVisible();
  await expect(page.getByTestId("doc-pane")).toBeVisible();
  await expect(page.getByTestId("mind-canvas")).toBeVisible();

  const before = await workspace.getAttribute("data-split-ratio");
  const handle = page.getByTestId("split-handle");
  const box = await handle.boundingBox();
  if (!box) throw new Error("split handle is missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => workspace.getAttribute("data-split-ratio")).not.toBe(before);

  await page.getByTestId("collapse-doc").click();
  await expect(page.getByTestId("doc-pane")).toBeHidden();
  await expect(workspace).toHaveAttribute("data-collapsed", "doc");
  await expect(page.getByTestId("collapse-doc")).toHaveAttribute("aria-label", "展开文档");
  await expect(page.getByTestId("collapse-doc")).toHaveText("展开文档");
  await shot(page, "doc-collapsed.png");
  await page.getByTestId("collapse-doc").click();
  await expect(page.getByTestId("doc-pane")).toBeVisible();
  await expect(page.getByTestId("collapse-doc")).toHaveAttribute("aria-label", "收起文档");
  await expect(page.getByTestId("collapse-doc")).toHaveText("收起文档");
  await shot(page, "doc-expanded.png");

  await page.getByTestId("collapse-map").click();
  await expect(page.getByTestId("mind-pane")).toBeHidden();
  await expect(page.getByTestId("collapse-map")).toHaveAttribute("aria-label", "展开脑图");
  await expect(page.getByTestId("collapse-map")).toHaveText("展开脑图");
  await shot(page, "map-collapsed.png");
  await page.getByTestId("collapse-map").click();
  await expect(page.getByTestId("mind-pane")).toBeVisible();
  await expect(page.getByTestId("collapse-map")).toHaveAttribute("aria-label", "收起脑图");
  await expect(page.getByTestId("collapse-map")).toHaveText("收起脑图");
  await shot(page, "map-expanded.png");

  await page.getByTestId("link-mode").click();
  const linkMenu = page.getByTestId("link-mode-menu");
  await expect(linkMenu).toBeVisible();
  const menuBox = await linkMenu.boundingBox();
  const docToggleBox = await page.getByTestId("collapse-doc").boundingBox();
  if (!menuBox || !docToggleBox) throw new Error("link menu or collapse control is missing");
  const overlapsDocToggle =
    menuBox.y < docToggleBox.y + docToggleBox.height &&
    menuBox.y + menuBox.height > docToggleBox.y &&
    menuBox.x < docToggleBox.x + docToggleBox.width &&
    menuBox.x + menuBox.width > docToggleBox.x;
  expect(overlapsDocToggle).toBe(false);
  await page.keyboard.press("Escape");
  await expect(linkMenu).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workspace).toHaveAttribute("data-layout", "stack");
});

test("selecting pdf text opens an excerpt popover and links the card both ways", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByTestId("workspace-name").fill("mn-link");
  await page.getByTestId("create-workspace").click();
  await expect(page.getByTestId("workspace-title")).toHaveText("mn-link");

  await page.getByTestId("upload-pdf").setInputFiles(await writePdf([SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO]));
  await expect(page.getByTestId("study-workspace")).toBeVisible();
  await expect(page.getByTestId("pdf-text-layer")).toContainText(SAMPLE_PAGE_ONE, { timeout: 20_000 });
  await shot(page, "workspace-pdf-desktop.png");

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("2");
  await page.getByTestId("pdf-text-layer").locator("span", { hasText: SAMPLE_PAGE_TWO }).selectText();

  const popover = page.getByTestId("excerpt-popover");
  await expect(popover).toBeVisible();
  await expect(popover.getByTestId("popover-excerpt")).toBeVisible();
  await expect(popover.getByTestId("popover-excerpt-title")).toBeVisible();
  await expect(popover.getByTestId("popover-comment")).toBeVisible();
  await expect(popover.getByTestId("excerpt-color")).toHaveCount(8);
  await expect(popover.getByTestId("excerpt-style-fill")).toHaveAttribute("data-active", "true");
  await shot(page, "excerpt-popover-desktop.png");

  await popover.locator("[data-testid='excerpt-color'][data-color='4']").click();
  await popover.getByTestId("excerpt-style-underline").click();
  await expect(popover.getByTestId("excerpt-style-underline")).toHaveAttribute("data-active", "true");
  await popover.getByTestId("popover-excerpt").click();

  const card = page.getByTestId("excerpt-card").filter({ hasText: SAMPLE_PAGE_TWO });
  await expect(card).toBeVisible();
  const highlight = page.getByTestId("excerpt-highlight");
  await expect(highlight).toBeVisible();
  await expect(highlight).toHaveAttribute("data-highlight", "underline");
  await expect(highlight).toHaveAttribute("data-color", "4");

  const node = page.getByTestId("mind-node").filter({ hasText: SAMPLE_PAGE_TWO });
  await expect(node).toHaveAttribute("data-selected", "true");
  await node.locator("[data-testid='card-color'][data-color='2']").click();
  await expect(node).toHaveAttribute("data-color", "2");
  await expect(highlight).toHaveAttribute("data-color", "2");
  await expect(node).toHaveAttribute("data-selected", "true");

  await page.getByRole("button", { name: "上一页" }).click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("1");
  await node.click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("2");
  await expect(page.getByTestId("excerpt-highlight")).toBeVisible();

  await page.getByTestId("link-mode").click();
  await page.getByTestId("link-off").click();
  await expect(page.getByTestId("study-workspace")).toHaveAttribute("data-link-mode", "off");
  await expect(page.getByTestId("link-hint")).toHaveText("联动：关闭");
  await page.getByRole("button", { name: "上一页" }).click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("1");
  await node.click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("1");

  await page.getByTestId("link-mode").click();
  await page.getByTestId("link-doc-to-map").click();
  const canvas = page.getByTestId("mind-canvas");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("mind canvas is missing");
  await canvas.click({ position: { x: Math.max(8, canvasBox.width - 12), y: Math.max(8, canvasBox.height - 12) } });
  await expect(node).toHaveAttribute("data-selected", "false");
  await card.click();
  await expect(node).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("reader-current-page")).toHaveText("2");
  await page.getByRole("button", { name: "上一页" }).click();
  await node.click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("1");

  await page.getByTestId("pdf-text-layer").locator("span", { hasText: SAMPLE_PAGE_ONE }).selectText();
  await expect(popover).toBeVisible();
  await popover.getByTestId("popover-comment").click();
  await popover.getByTestId("popover-comment-input").fill("证明思路");
  await popover.getByTestId("popover-comment-save").click();
  await expect(page.getByTestId("excerpt-card").filter({ hasText: "证明思路" })).toBeVisible();
  await expect(page.getByTestId("mind-node").filter({ hasText: "证明思路" })).toBeVisible();

  await page.getByTestId("pdf-text-layer").locator("span", { hasText: SAMPLE_PAGE_ONE }).selectText();
  await expect(popover).toBeVisible();
  await popover.getByTestId("popover-excerpt-title").click();
  await expect(page.getByTestId("excerpt-highlight")).toHaveAttribute("data-highlight", "title");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("study-workspace")).toHaveAttribute("data-layout", "stack");
  await shot(page, "workspace-pdf-phone.png");
  await page.getByTestId("pdf-text-layer").locator("span", { hasText: SAMPLE_PAGE_ONE }).selectText();
  await expect(popover).toBeVisible();
  await shot(page, "excerpt-popover-phone.png");
});

test("epub excerpts locate from the mind map with a cfi", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByTestId("workspace-name").fill("mn-epub");
  await page.getByTestId("create-workspace").click();
  await expect(page.getByTestId("workspace-title")).toHaveText("mn-epub");
  await page.getByTestId("upload-epub").setInputFiles(
    await writeEpub([SAMPLE_EPUB_CHAPTER_ONE, SAMPLE_EPUB_CHAPTER_TWO]),
  );

  const chapter = () => page.frameLocator('[data-testid="epub-viewer"] iframe').locator("body");
  await expect(chapter()).toContainText(SAMPLE_EPUB_CHAPTER_ONE, { timeout: 20_000 });
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(chapter()).toContainText(SAMPLE_EPUB_CHAPTER_TWO, { timeout: 20_000 });
  await shot(page, "workspace-epub-desktop.png");

  await chapter().locator("p").selectText();
  await page.getByTestId("create-excerpt").click();
  const card = page.getByTestId("excerpt-card");
  await expect(card).toContainText(SAMPLE_EPUB_CHAPTER_TWO);
  await expect(page.getByTestId("epub-highlight")).toBeVisible();

  const node = page.getByTestId("mind-node").filter({ hasText: SAMPLE_EPUB_CHAPTER_TWO });
  await expect(node).toBeVisible();
  await page.getByRole("button", { name: "上一页" }).click();
  await expect(chapter()).toContainText(SAMPLE_EPUB_CHAPTER_ONE, { timeout: 20_000 });
  await node.click();
  await expect(chapter()).toContainText(SAMPLE_EPUB_CHAPTER_TWO, { timeout: 20_000 });
  await expect(page.getByTestId("epub-highlight")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("study-workspace")).toHaveAttribute("data-layout", "stack");
  await shot(page, "workspace-epub-phone.png");
});

test("a selected mind-map card shows a dark menu, child edge, color, and tag", async ({ page }) => {
  await page.goto("/map?workspaceId=e2e-mn");
  await expect(page.getByTestId("mind-canvas")).toHaveCSS("background-color", "rgb(242, 242, 242)");
  await page.getByTestId("add-note").click();
  const freshNote = page.getByTestId("note-editor");
  await expect(freshNote).toHaveValue("笔记 1");
  await freshNote.press("Escape");
  const named = page.getByTestId("mind-node").filter({ hasText: "笔记 1" });
  await expect(named).toBeVisible();
  const parentId = await named.getAttribute("data-node-id");
  if (!parentId) throw new Error("note id is missing");
  const parent = page.locator(`[data-testid="mind-node"][data-node-id="${parentId}"]`);
  await parent.click();
  await expect(parent).toHaveAttribute("data-selected", "true");
  await expect(parent).toHaveCSS("outline-style", "dashed");
  const popup = page.getByTestId("card-popup");
  await expect(popup).toBeVisible();
  await expect(popup).toHaveCSS("background-color", "rgb(43, 43, 45)");
  await expect(popup.getByTestId("card-add-child")).toBeVisible();
  await expect(popup.getByTestId("card-add-sibling")).toBeVisible();
  await expect(popup.getByTestId("card-delete")).toBeVisible();
  await expect(popup.getByTestId("card-rename")).toBeVisible();
  await expect(popup.getByTestId("card-color")).toHaveCount(8);
  await shot(page, "card-selected-desktop.png");

  await popup.getByTestId("card-add-child").click();
  const childEditor = page.getByTestId("note-editor");
  await expect(childEditor).toHaveValue("子卡片");
  await childEditor.press("Escape");
  const child = page.getByTestId("mind-node").filter({ hasText: "子卡片" });
  await expect(child).toBeVisible();
  await expect(page.getByTestId("edge-kind")).toHaveValue("child");
  const edgePath = await page.getByTestId("mind-edge").getAttribute("d");
  expect(edgePath ?? "").toMatch(/[HV]/);
  expect(edgePath ?? "").not.toMatch(/\bC\b/);

  await parent.getByTestId("node-collapse").click();
  await expect(parent).toHaveAttribute("data-collapsed", "true");
  await expect(child).toHaveCount(0);
  await parent.getByTestId("node-collapse").click();
  await expect(child).toBeVisible();

  await parent.click();
  await popup.locator("[data-testid='card-color'][data-color='6']").click();
  await expect(parent).toHaveAttribute("data-color", "6");
  await popup.getByTestId("card-tag-input").fill("定理");
  await popup.getByTestId("card-tag-input").press("Enter");
  await expect(parent.getByTestId("node-tags")).toContainText("#定理");
  await parent.getByTestId("tag-remove").click();
  await expect(parent.getByTestId("node-tags")).toHaveCount(0);

  await child.click();
  const deleteCard = page.getByTestId("card-popup").getByTestId("card-delete");
  await deleteCard.click();
  await expect(deleteCard).toHaveText("确认删除");
  await expect(child).toHaveCount(1);
  await deleteCard.click();
  await expect(child).toHaveCount(0);
  await expect(page.getByTestId("mind-edge")).toHaveCount(0);

  await parent.click();
  await page.keyboard.press("F2");
  const titleFromKey = page.getByTestId("note-title-editor");
  await expect(titleFromKey).toBeVisible();
  await titleFromKey.press("Escape");
  await expect(titleFromKey).toHaveCount(0);
  const editor = page.getByTestId("note-editor");
  await parent.getByTestId("note-body").dblclick();
  await expect(editor).toBeVisible();
  await editor.fill("笔记已改");
  await shot(page, "note-editing.png");
  await page.getByTestId("note-save").click();
  await expect(parent).toContainText("笔记已改");
  await expect(parent.getByTestId("note-save-status")).toHaveText("已保存");
  await shot(page, "note-saved.png");
  await parent.getByTestId("note-title").dblclick();
  const titleEditor = page.getByTestId("note-title-editor");
  await expect(titleEditor).toBeVisible();
  await titleEditor.fill("定理卡");
  await titleEditor.press("Enter");
  await expect(parent).toContainText("定理卡");

  await page.setViewportSize({ width: 390, height: 844 });
  await parent.click();
  await expect(page.getByTestId("card-popup")).toBeVisible();
  await shot(page, "card-selected-phone.png");
});
