import { expect, test } from "@playwright/test";
import { authToken } from "./auth-token";

test("wrong token is rejected and the right token can create a workspace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId("login-form")).toBeVisible();

  const blocked = await page.request.get("/api/workspaces");
  expect(blocked.status()).toBe(401);

  await page.getByTestId("auth-token").fill("wrong-token");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const submitBox = await page.getByTestId("auth-submit").boundingBox();
  expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(40);

  await page.getByTestId("auth-token").fill(authToken);
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("app-shell")).toBeVisible();

  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === "read_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.value ?? "").not.toContain(authToken);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

  await page.getByTestId("library-menu").click();
  await page.getByTestId("workspace-name").fill("mobile-auth");
  await page.getByTestId("create-workspace").click();
  await expect(page.getByTestId("workspace-title")).toHaveText("mobile-auth");

  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
