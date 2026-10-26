import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";
import { runInDocker } from "./docker-runner";

function dockerTestsEnabled(): boolean {
  if (process.env.READ_DOCKER_TESTS === "0") return false;
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

const enabled = dockerTestsEnabled();

test.skipIf(!enabled)(
  "python print(1+1) returns stdout 2",
  async () => {
    const result = await runInDocker({ language: "python", source: "print(1+1)\n" });
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("2");
  },
  180_000,
);

test.skipIf(!enabled)(
  "javascript console.log returns stdout 2",
  async () => {
    const result = await runInDocker({
      language: "javascript",
      source: "console.log(1+1)\n",
    });
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("2");
  },
  180_000,
);

test.skipIf(!enabled)(
  "go fmt.Println returns stdout 2",
  async () => {
    const result = await runInDocker({
      language: "go",
      source: `package main
import "fmt"
func main() { fmt.Println(1 + 1) }
`,
    });
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("2");
  },
  180_000,
);

test.skipIf(!enabled)(
  "a sleeping python process times out",
  async () => {
    const result = await runInDocker({
      language: "python",
      source: "import time\ntime.sleep(30)\n",
      timeoutMs: 1000,
    });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  },
  60_000,
);
