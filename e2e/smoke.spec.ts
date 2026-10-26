import { expect, test } from "@playwright/test";

test("home shows the library shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Read" })).toBeVisible();
  await expect(page.getByTestId("library-empty")).toBeVisible();
  await expect(page.getByText("还没有文档")).toBeVisible();
  await expect(page.getByText("Hello World")).toHaveCount(0);
});
