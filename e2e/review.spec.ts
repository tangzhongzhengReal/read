import { expect, test } from "@playwright/test";

test("creating a review item and checking it off survives refresh", async ({ page }) => {
  await page.goto("/review?workspaceId=e2e-review");
  await page.getByTestId("review-note-text").fill("spaced fact");
  await page.getByTestId("add-review-item").click();

  const item = page.getByTestId("review-item");
  await expect(item).toContainText("spaced fact");
  await expect(item.getByTestId("review-check")).not.toBeChecked();

  await item.getByTestId("review-check").click();
  await expect(item.getByTestId("review-check")).toBeChecked();
  await expect(item.getByTestId("next-review")).toContainText(/\d{4}-\d{2}-\d{2}/);

  await page.reload();
  const reloaded = page.getByTestId("review-item");
  await expect(reloaded).toContainText("spaced fact");
  await expect(reloaded.getByTestId("review-check")).toBeChecked();
  await expect(reloaded.getByTestId("next-review")).toContainText(/\d{4}-\d{2}-\d{2}/);
});
