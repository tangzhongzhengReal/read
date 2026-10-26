import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const runtimeDir = path.join(process.cwd(), "e2e-runtime");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "rm -rf e2e-runtime && mkdir -p e2e-runtime/data e2e-runtime/uploads && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      READ_DATA_DIR: path.join(runtimeDir, "data"),
      READ_UPLOADS_DIR: path.join(runtimeDir, "uploads"),
    },
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "auth",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
    {
      name: "chromium",
      testIgnore: [/smoke\.spec\.ts/, /auth\.spec\.ts/, /auth\.setup\.ts/],
      dependencies: ["smoke"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
  ],
});
