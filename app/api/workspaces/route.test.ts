import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { resetWorkspaceStores } from "@/src/lib/store/workspaces";
import { GET, POST } from "./route";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-workspaces-"));
  process.env.READ_DATA_DIR = dataDir;
  resetWorkspaceStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetWorkspaceStores();
});

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("a workspace is stored in JSONL and listed after the store reloads", async () => {
  const created = await post({ name: "相位四" });
  expect(created.status).toBe(201);
  const createdBody = (await created.json()) as {
    workspace: { id: string; name: string };
  };
  expect(createdBody.workspace.name).toBe("相位四");
  expect(createdBody.workspace.id).toMatch(/^[\w-]+$/);

  resetWorkspaceStores();
  const listed = await GET();
  expect(listed.status).toBe(200);
  const listedBody = (await listed.json()) as {
    workspaces: Array<{ id: string; name: string }>;
  };
  expect(listedBody.workspaces).toEqual([
    expect.objectContaining({ id: createdBody.workspace.id, name: "相位四" }),
  ]);

  const raw = await readFile(path.join(dataDir, "workspaces.jsonl"), "utf8");
  expect(raw).toContain("相位四");
});

test("a blank workspace name is rejected", async () => {
  const response = await post({ name: "   " });
  expect(response.status).toBe(400);
});
