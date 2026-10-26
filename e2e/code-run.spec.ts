import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

function dockerAvailable(): boolean {
  if (process.env.READ_DOCKER_TESTS === "0") return false;
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

test("running a python code node shows stdout", async ({ page }) => {
  test.skip(!dockerAvailable(), "Docker is not available; code execution e2e is skipped");

  await page.goto("/map?workspaceId=e2e-code");
  await page.getByTestId("add-code-node").click();
  const node = page.getByTestId("code-node");
  await node.getByTestId("code-language").selectOption("python");
  await node.getByTestId("code-source").fill("print(1+1)");
  await node.getByTestId("run-code").click();
  await expect(node.getByTestId("code-status")).toHaveText("succeeded", { timeout: 180_000 });
  await expect(node.getByTestId("code-stdout")).toContainText("2");
});
