import { expect, test } from "@playwright/test";

test("dragging a note and connecting an edge persists after refresh", async ({ page }) => {
  await page.goto("/map?workspaceId=e2e-map");
  await page.getByTestId("add-note").click();
  const firstEditor = page.getByTestId("note-editor");
  await expect(firstEditor).toBeVisible();
  await firstEditor.press("Escape");
  await page.getByTestId("add-note").click();
  const secondEditor = page.getByTestId("note-editor");
  await expect(secondEditor).toBeVisible();
  await secondEditor.press("Escape");
  const notes = page.getByTestId("mind-node");
  await expect(notes).toHaveCount(2);

  const first = notes.nth(0);
  const nodeId = await first.getAttribute("data-node-id");
  const startY = Number(await first.getAttribute("data-y"));
  const handle = first.getByTestId("note-drag");
  const box = await handle.boundingBox();
  if (!box || !nodeId) throw new Error("note is not ready to drag");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 160, { steps: 12 });
  await page.mouse.up();

  const dragged = page.locator(`[data-testid="mind-node"][data-node-id="${nodeId}"]`);
  await expect
    .poll(async () => Number(await dragged.getAttribute("data-y")))
    .toBeGreaterThan(startY + 40);
  const savedY = Number(await dragged.getAttribute("data-y"));

  await notes.nth(0).getByTestId("node-source").dragTo(notes.nth(1).getByTestId("node-target"));
  await expect(page.getByTestId("mind-edge")).toHaveCount(1);

  await page.getByTestId("edge-kind").selectOption("supports");
  await expect(page.getByTestId("edge-kind")).toHaveValue("supports");

  await page.reload();
  await expect(page.getByTestId("mind-node")).toHaveCount(2);
  await expect(page.getByTestId("mind-edge")).toHaveCount(1);
  const reloaded = page.locator(`[data-testid="mind-node"][data-node-id="${nodeId}"]`);
  await expect
    .poll(async () => Number(await reloaded.getAttribute("data-y")))
    .toBeGreaterThan(startY + 40);
  expect(Number(await reloaded.getAttribute("data-y"))).toBeCloseTo(savedY, 0);
  await expect(page.getByTestId("edge-kind")).toHaveValue("supports");

  await page.getByTestId("delete-edge").click();
  await expect(page.getByTestId("mind-edge")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("mind-node")).toHaveCount(2);
  await expect(page.getByTestId("mind-edge")).toHaveCount(0);
});
