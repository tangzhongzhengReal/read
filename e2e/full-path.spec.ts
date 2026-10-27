import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { buildTextPdf, SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO } from "../src/lib/pdf/text-pdf";

function dockerAvailable(): boolean {
  if (process.env.READ_DOCKER_TESTS === "0") return false;
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

test("workspace, document, excerpt, edge, review, and optional code run survive refresh", async ({
  page,
}) => {
  const docker = dockerAvailable();
  test.setTimeout(docker ? 240_000 : 120_000);

  await page.goto("/");
  await page.getByTestId("workspace-name").fill("phase4");
  await page.getByTestId("create-workspace").click();
  await expect(page.getByTestId("workspace-title")).toHaveText("phase4");
  const workspaceId = (await page.getByTestId("workspace-id").textContent())?.trim() ?? "";
  expect(workspaceId).not.toBe("");
  expect(workspaceId).not.toBe("local");

  const dir = await mkdtemp(path.join(tmpdir(), "read-e2e-full-"));
  const pdfPath = path.join(dir, "sample.pdf");
  await writeFile(pdfPath, buildTextPdf([SAMPLE_PAGE_ONE, SAMPLE_PAGE_TWO]));

  await page.getByTestId("upload-pdf").setInputFiles(pdfPath);
  await expect(page.getByTestId("pdf-text-layer")).toContainText(SAMPLE_PAGE_ONE, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByTestId("reader-current-page")).toHaveText("2");
  await page
    .getByTestId("pdf-text-layer")
    .locator("span", { hasText: SAMPLE_PAGE_TWO })
    .selectText();
  await page.getByTestId("create-excerpt").click();
  await expect(page.getByTestId("excerpt-card")).toContainText(SAMPLE_PAGE_TWO);

  await page.getByTestId("open-mind-map").click();
  await expect(page.getByTestId("mind-node")).toHaveCount(1);
  await expect(page.getByTestId("mind-node")).toContainText(SAMPLE_PAGE_TWO);
  await page.getByTestId("add-note").click();
  const noteEditor = page.getByTestId("note-editor");
  await expect(noteEditor).toBeVisible();
  await noteEditor.press("Escape");
  await expect(page.getByTestId("mind-node")).toHaveCount(2);
  const notes = page.getByTestId("mind-node");
  await notes.nth(0).getByTestId("node-source").dragTo(notes.nth(1).getByTestId("node-target"));
  await expect(page.getByTestId("mind-edge")).toHaveCount(1);

  if (docker) {
    await page.getByTestId("add-code-node").click();
    const code = page.getByTestId("code-node");
    await code.getByTestId("code-language").selectOption("python");
    await code.getByTestId("code-source").fill("print(1+1)");
    await code.getByTestId("run-code").click();
    await expect(code.getByTestId("code-status")).toHaveText("succeeded", { timeout: 180_000 });
    await expect(code.getByTestId("code-stdout")).toContainText("2");
  }

  await page.getByTestId("open-review").click();
  const candidate = page.getByTestId("review-candidate").filter({ hasText: SAMPLE_PAGE_TWO });
  await candidate.getByTestId("add-to-review").click();
  const item = page.getByTestId("review-item").filter({ hasText: SAMPLE_PAGE_TWO });
  await expect(item.getByTestId("review-check")).not.toBeChecked();
  await item.getByTestId("review-check").click();
  await expect(item.getByTestId("review-check")).toBeChecked();
  await expect(item.getByTestId("next-review")).toBeVisible();

  await page.reload();
  const reloaded = page.getByTestId("review-item").filter({ hasText: SAMPLE_PAGE_TWO });
  await expect(reloaded.getByTestId("review-check")).toBeChecked();
  await expect(reloaded.getByTestId("next-review")).toBeVisible();

  await page.goto(`/map?workspaceId=${encodeURIComponent(workspaceId)}`);
  await expect(page.getByTestId("mind-node")).toHaveCount(2);
  await expect(page.getByTestId("mind-node").first()).toContainText(SAMPLE_PAGE_TWO);
  await expect(page.getByTestId("mind-edge")).toHaveCount(1);
  if (docker) {
    await expect(page.getByTestId("code-node").getByTestId("code-status")).toHaveText("succeeded");
    await expect(page.getByTestId("code-node").getByTestId("code-stdout")).toContainText("2");
  }

  await page.goto(`/?workspaceId=${encodeURIComponent(workspaceId)}`);
  await expect(page.getByTestId("document-card")).toContainText("sample");
  await page.goto("/");
  await expect(page.getByTestId("workspace-link").filter({ hasText: "phase4" })).toBeVisible();
});
