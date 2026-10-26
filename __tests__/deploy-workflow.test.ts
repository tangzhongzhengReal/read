import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("deploy keeps the SSH secrets and publishes a Node server instead of a static export", () => {
  const yaml = readFileSync(".github/workflows/deploy.yml", "utf8");

  expect(yaml).toContain("secrets.SSH_HOST");
  expect(yaml).toContain("secrets.SSH_PORT");
  expect(yaml).toContain("secrets.SSH_USER");
  expect(yaml).toContain("secrets.SSH_PRIVATE_KEY");
  expect(yaml).toContain("scripts/package-standalone.sh");
  expect(yaml).toContain("remote-install.sh");
  expect(yaml).not.toContain("build:nginx");
  expect(yaml).not.toContain("/var/www/read");
});
