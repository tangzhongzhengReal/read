import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { resetNodeStores } from "@/src/lib/store/nodes";
import { GET, POST } from "./route";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-node-create-"));
  process.env.READ_DATA_DIR = dataDir;
  resetNodeStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetNodeStores();
});

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("a note and a code node are stored and listed with excerpts for one workspace", async () => {
  const excerpt = await post({
    workspaceId: "ws-1",
    documentId: "doc-1",
    type: "excerpt",
    payload: { text: "quoted" },
    anchor: { page: 1, rects: [{ x: 0, y: 0, width: 0.2, height: 0.1 }] },
  });
  expect(excerpt.status).toBe(201);

  const note = await post({
    workspaceId: "ws-1",
    type: "note",
    payload: { text: "margin note" },
    position: { x: 10, y: 20 },
  });
  expect(note.status).toBe(201);
  const noteBody = (await note.json()) as {
    node: { id: string; type: string; payload: { text: string }; position: { x: number; y: number } };
  };
  expect(noteBody.node.type).toBe("note");
  expect(noteBody.node.payload.text).toBe("margin note");
  expect(noteBody.node.position).toEqual({ x: 10, y: 20 });

  const code = await post({
    workspaceId: "ws-1",
    type: "code",
    payload: { language: "python", source: "print(1+1)" },
    position: { x: 30, y: 40 },
  });
  expect(code.status).toBe(201);

  const listed = await GET(new NextRequest("http://localhost/api/nodes?workspaceId=ws-1"));
  const listedBody = (await listed.json()) as { nodes: Array<{ type: string }> };
  expect(listedBody.nodes.map((node) => node.type).sort()).toEqual([
    "code",
    "excerpt",
    "note",
  ]);

  const raw = await readFile(path.join(dataDir, "ws-1", "nodes.jsonl"), "utf8");
  expect(raw).toContain('"type":"note"');
  expect(raw).toContain('"type":"code"');
  expect(raw).toContain("print(1+1)");
});

test("a code node with an unknown language is rejected", async () => {
  const response = await post({
    workspaceId: "ws-1",
    type: "code",
    payload: { language: "ruby", source: "puts 1" },
  });
  expect(response.status).toBe(400);
});
