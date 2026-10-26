import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { resetCodeExecutor, setCodeExecutor } from "@/src/lib/code-run/executor";
import { NodeSchema } from "@/src/lib/models";
import { resetCodeRunStores } from "@/src/lib/store/code-runs";
import { getNodeStore, resetNodeStores } from "@/src/lib/store/nodes";
import { GET as GET_ONE } from "./[id]/route";
import { GET, POST } from "./route";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-code-api-"));
  process.env.READ_DATA_DIR = dataDir;
  resetNodeStores();
  resetCodeRunStores();
  resetCodeExecutor();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetNodeStores();
  resetCodeRunStores();
  resetCodeExecutor();
});

const now = "2026-10-26T00:00:00.000Z";

async function seedCode(id: string, source = "print(1+1)") {
  await getNodeStore("ws-1").append(
    NodeSchema.parse({
      id,
      workspaceId: "ws-1",
      type: "code",
      payload: { language: "python", source },
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/code-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("posting a code run stores queued, running, and succeeded without eval", async () => {
  await seedCode("code-1");
  setCodeExecutor(async (input) => {
    expect(input).toMatchObject({ language: "python", source: "print(1+1)" });
    return { stdout: "2\n", stderr: "", exitCode: 0, timedOut: false };
  });

  const response = await post({ workspaceId: "ws-1", nodeId: "code-1" });
  expect(response.status).toBe(201);
  const body = (await response.json()) as {
    run: { id: string; status: string; stdout: string; language: string; workspaceId: string };
  };
  expect(body.run).toMatchObject({
    status: "succeeded",
    stdout: "2\n",
    language: "python",
    workspaceId: "ws-1",
  });

  const raw = await readFile(path.join(dataDir, "ws-1", "code-runs.jsonl"), "utf8");
  const stored = raw
    .trim()
    .split("\n")
    .map((line) => (JSON.parse(line) as { status: string }).status);
  expect(stored).toEqual(["queued", "running", "succeeded"]);

  const listed = await GET(
    new NextRequest("http://localhost/api/code-runs?workspaceId=ws-1&nodeId=code-1"),
  );
  const listedBody = (await listed.json()) as { runs: Array<{ id: string; status: string }> };
  expect(listedBody.runs.map((run) => run.status)).toEqual(["succeeded"]);

  const one = await GET_ONE(
    new NextRequest(
      `http://localhost/api/code-runs/${body.run.id}?workspaceId=ws-1`,
    ),
    { params: Promise.resolve({ id: body.run.id }) },
  );
  expect(one.status).toBe(200);
});

test("timeout, failure, notes, and missing nodes are rejected or recorded", async () => {
  await seedCode("code-1", "while True: pass");
  setCodeExecutor(async () => ({
    stdout: "",
    stderr: "",
    exitCode: null,
    timedOut: true,
  }));
  const timedOut = await post({ workspaceId: "ws-1", nodeId: "code-1" });
  expect(timedOut.status).toBe(201);
  const timedBody = (await timedOut.json()) as { run: { status: string } };
  expect(timedBody.run.status).toBe("timed_out");

  await getNodeStore("ws-1").append(
    NodeSchema.parse({
      id: "note-1",
      workspaceId: "ws-1",
      type: "note",
      payload: { text: "not code" },
      createdAt: now,
      updatedAt: now,
    }),
  );
  expect((await post({ workspaceId: "ws-1", nodeId: "note-1" })).status).toBe(400);
  expect((await post({ workspaceId: "ws-1", nodeId: "missing" })).status).toBe(404);
  expect((await GET(new NextRequest("http://localhost/api/code-runs"))).status).toBe(400);
});

test("an explicit source override is what the runner receives", async () => {
  await seedCode("code-1", "print(0)");
  let seen = "";
  setCodeExecutor(async (input) => {
    seen = input.source;
    return { stdout: "2\n", stderr: "", exitCode: 0, timedOut: false };
  });
  const response = await post({
    workspaceId: "ws-1",
    nodeId: "code-1",
    language: "javascript",
    source: "console.log(1+1)",
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { run: { language: string; source: string } };
  expect(body.run.language).toBe("javascript");
  expect(body.run.source).toBe("console.log(1+1)");
  expect(seen).toBe("console.log(1+1)");
});
