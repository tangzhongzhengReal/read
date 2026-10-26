import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { expect, test, vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
  execFileSync: vi.fn(),
}));

const spawnMock = vi.mocked(spawn);

function installSpawn(impl: (command: string, args: readonly string[]) => FakeProcess) {
  spawnMock.mockImplementation(impl as never);
}

type FakeProcess = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  kill: ReturnType<typeof vi.fn>;
};

function fakeProcess(): FakeProcess {
  const proc = new EventEmitter() as FakeProcess;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.kill = vi.fn();
  return proc;
}

function succeed(proc: FakeProcess, stdout = "", code = 0) {
  queueMicrotask(() => {
    if (stdout) proc.stdout.emit("data", Buffer.from(stdout));
    proc.emit("close", code);
  });
}

test("runner source never evaluates user code inside the node process", () => {
  for (const file of [
    "src/lib/code-run/docker-runner.ts",
    "src/lib/code-run/execute.ts",
    "app/api/code-runs/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
    expect(source).not.toMatch(/\bvm\./);
    expect(source).not.toMatch(/\bexecSync\s*\(/);
    expect(source).not.toMatch(/\bexec\s*\(/);
  }
});

test("docker args isolate the container and do not shell out the source", async () => {
  const { buildDockerArgs } = await import("./docker-runner");
  const python = buildDockerArgs({
    containerName: "read-run-1",
    language: "python",
    workDir: "/tmp/work",
  });
  expect(python[0]).toBe("run");
  expect(python).toEqual(
    expect.arrayContaining([
      "--network=none",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--rm",
      "--name",
      "read-run-1",
      "--user",
      "65534:65534",
      "python:3.12-alpine",
    ]),
  );
  expect(python.slice(-3)).toEqual(["python", "-I", "/work/main.py"]);
  expect(python).not.toContain("sh");
  expect(python).not.toContain("bash");
  expect(python).not.toContain("-c");

  const javascript = buildDockerArgs({
    containerName: "read-run-2",
    language: "javascript",
    workDir: "/tmp/work",
  });
  expect(javascript).toContain("node:22-alpine");
  expect(javascript.slice(-2)).toEqual(["node", "/work/main.js"]);

  const go = buildDockerArgs({
    containerName: "read-run-3",
    language: "go",
    workDir: "/tmp/work",
  });
  expect(go).toContain("golang:1.23-alpine");
  expect(go).toContain("GO111MODULE=off");
  expect(go.slice(-3)).toEqual(["go", "run", "/work/main.go"]);
});

test("runInDocker writes the source to a file and returns stdout", async () => {
  spawnMock.mockReset();
  let written = "";
  installSpawn((_command, args) => {
    const proc = fakeProcess();
    if (args[0] === "image") {
      succeed(proc, "", 0);
      return proc;
    }
    const mount = args.find((arg) => arg.startsWith("type=bind"));
    const sourcePath = mount?.match(/src=([^,]+)/)?.[1];
    if (sourcePath) written = readFileSync(`${sourcePath}/main.js`, "utf8");
    succeed(proc, "2\n", 0);
    return proc;
  });

  const { runInDocker } = await import("./docker-runner");
  const source = "console.log(1+1); $(rm -rf /)";
  const result = await runInDocker({ language: "javascript", source });

  expect(result).toMatchObject({ stdout: "2\n", exitCode: 0, timedOut: false });
  expect(written).toBe(source);
  const runCall = spawnMock.mock.calls.find((call) => call[1][0] === "run");
  expect(runCall?.[0]).toBe("docker");
  expect(runCall?.[2]).toMatchObject({ shell: false });
  expect(String(runCall?.[1].join(" "))).not.toContain(source);
  expect(String(runCall?.[1].join(" "))).not.toContain("rm -rf");
});

test("a hung container is killed and reported as timed out", async () => {
  spawnMock.mockReset();
  let runProc: FakeProcess | null = null;
  installSpawn((_command, args) => {
    const proc = fakeProcess();
    if (args[0] === "image") {
      succeed(proc, "", 0);
      return proc;
    }
    if (args[0] === "kill") {
      queueMicrotask(() => {
        runProc?.emit("close", 137);
        proc.emit("close", 0);
      });
      return proc;
    }
    runProc = proc;
    return proc;
  });

  const { runInDocker } = await import("./docker-runner");
  const result = await runInDocker({
    language: "python",
    source: "import time\ntime.sleep(30)\n",
    timeoutMs: 30,
  });
  expect(result.timedOut).toBe(true);
  expect(spawnMock.mock.calls.some((call) => call[1][0] === "kill")).toBe(true);
});

test("stdin is piped to the container and missing docker rejects", async () => {
  spawnMock.mockReset();
  const writes: string[] = [];
  installSpawn((_command, args) => {
    const proc = fakeProcess();
    proc.stdin.write.mockImplementation((chunk: string | Buffer) => {
      writes.push(String(chunk));
    });
    if (args[0] === "image") {
      succeed(proc, "", 0);
      return proc;
    }
    queueMicrotask(() => proc.emit("error", new Error("spawn docker ENOENT")));
    return proc;
  });
  const { runInDocker } = await import("./docker-runner");
  await expect(
    runInDocker({ language: "python", source: "print(1)", stdin: "hello" }),
  ).rejects.toThrow(/ENOENT/);
  expect(writes.join("")).toContain("hello");
});

test("stdout is capped and the work directory is removed", async () => {
  spawnMock.mockReset();
  let workDir = "";
  installSpawn((_command, args) => {
    const proc = fakeProcess();
    if (args[0] === "image") {
      succeed(proc, "", 0);
      return proc;
    }
    const mount = args.find((arg) => arg.startsWith("type=bind"));
    workDir = mount?.match(/src=([^,]+)/)?.[1] ?? "";
    succeed(proc, "x".repeat(200), 0);
    return proc;
  });
  const { runInDocker } = await import("./docker-runner");
  const result = await runInDocker({
    language: "python",
    source: "print(1)",
    maxOutputBytes: 32,
  });
  expect(result.stdout.length).toBeLessThanOrEqual(32 + "\n…[truncated]".length);
  expect(result.stdout).toContain("…[truncated]");
  await expect(readFile(workDir, "utf8")).rejects.toThrow();
});
