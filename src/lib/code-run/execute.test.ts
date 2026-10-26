import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { CodeRunSchema } from "@/src/lib/models";
import { getCodeRunStore, resetCodeRunStores } from "@/src/lib/store/code-runs";
import { executeQueuedCodeRun } from "./execute";
import { resetCodeExecutor, setCodeExecutor } from "./executor";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-code-run-"));
  process.env.READ_DATA_DIR = dataDir;
  resetCodeRunStores();
  resetCodeExecutor();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetCodeRunStores();
  resetCodeExecutor();
});

const now = "2026-10-26T00:00:00.000Z";

async function seedQueued() {
  const run = CodeRunSchema.parse({
    id: "run-1",
    workspaceId: "ws-1",
    nodeId: "node-1",
    status: "queued",
    language: "python",
    source: "print(1+1)",
    createdAt: now,
    updatedAt: now,
  });
  await getCodeRunStore("ws-1").append(run);
  return run;
}

async function statuses() {
  const raw = await readFile(path.join(dataDir, "ws-1", "code-runs.jsonl"), "utf8");
  return raw
    .trim()
    .split("\n")
    .map((line) => (JSON.parse(line) as { status: string }).status);
}

test("a queued run is persisted as running before the executor finishes", async () => {
  await seedQueued();
  let seen = "";
  setCodeExecutor(async () => {
    const current = await getCodeRunStore("ws-1").get("run-1");
    seen = current?.status ?? "";
    return { stdout: "2\n", stderr: "", exitCode: 0, timedOut: false };
  });

  const finished = await executeQueuedCodeRun("ws-1", "run-1");
  expect(seen).toBe("running");
  expect(finished).toMatchObject({
    id: "run-1",
    workspaceId: "ws-1",
    status: "succeeded",
    stdout: "2\n",
    stderr: "",
  });
  expect(await statuses()).toEqual(["queued", "running", "succeeded"]);
});

test("a non-zero exit is failed and a timeout is timed_out", async () => {
  await seedQueued();
  setCodeExecutor(async () => ({
    stdout: "",
    stderr: "boom",
    exitCode: 1,
    timedOut: false,
  }));
  const failed = await executeQueuedCodeRun("ws-1", "run-1");
  expect(failed.status).toBe("failed");
  expect(failed.stderr).toBe("boom");

  await getCodeRunStore("ws-1").append(
    CodeRunSchema.parse({
      id: "run-2",
      workspaceId: "ws-1",
      nodeId: "node-1",
      status: "queued",
      language: "javascript",
      source: "while (true) {}",
      createdAt: now,
      updatedAt: now,
    }),
  );
  setCodeExecutor(async () => ({
    stdout: "",
    stderr: "",
    exitCode: null,
    timedOut: true,
  }));
  const timedOut = await executeQueuedCodeRun("ws-1", "run-2");
  expect(timedOut.status).toBe("timed_out");
});

test("an executor crash is stored as failed and a finished run cannot start again", async () => {
  await seedQueued();
  setCodeExecutor(async () => {
    throw new Error("docker missing");
  });
  const failed = await executeQueuedCodeRun("ws-1", "run-1");
  expect(failed.status).toBe("failed");
  expect(failed.stderr).toContain("docker missing");
  await expect(executeQueuedCodeRun("ws-1", "run-1")).rejects.toThrow(/queued/);
});
