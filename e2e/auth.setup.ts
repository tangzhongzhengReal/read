import { mkdir } from "node:fs/promises";
import { expect, test as setup } from "@playwright/test";
import { authToken } from "./auth-token";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("auth-token").fill(authToken);
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await mkdir("e2e/.auth", { recursive: true });
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
