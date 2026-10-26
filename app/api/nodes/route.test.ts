import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { resetNodeStores } from "@/src/lib/store/nodes";
import { GET, POST } from "./route";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-nodes-"));
  process.env.READ_DATA_DIR = dataDir;
  resetNodeStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetNodeStores();
});

function excerptRequest(body: unknown) {
  return new NextRequest("http://localhost/api/nodes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const excerpt = {
  workspaceId: "ws-1",
  documentId: "doc-1",
  type: "excerpt",
  payload: { text: "EXCERPTTOKEN" },
  anchor: {
    page: 2,
    rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
  },
};

test("a selection payload is stored as an excerpt and can be filtered by document", async () => {
  const created = await POST(excerptRequest(excerpt));
  expect(created.status).toBe(201);
  const createdBody = (await created.json()) as {
    node: {
      id: string;
      type: string;
      documentId: string;
      payload: { text: string };
      anchor: { page: number; rects: Array<{ x: number }> };
    };
  };
  expect(createdBody.node.type).toBe("excerpt");
  expect(createdBody.node.documentId).toBe("doc-1");
  expect(createdBody.node.payload.text).toBe("EXCERPTTOKEN");
  expect(createdBody.node.anchor.page).toBe(2);
  expect(createdBody.node.anchor.rects[0]?.x).toBe(0.1);

  const other = await POST(
    excerptRequest({
      ...excerpt,
      documentId: "doc-2",
      payload: { text: "other document" },
    }),
  );
  expect(other.status).toBe(201);

  const listed = await GET(
    new NextRequest("http://localhost/api/nodes?workspaceId=ws-1&documentId=doc-1"),
  );
  expect(listed.status).toBe(200);
  const listedBody = (await listed.json()) as {
    nodes: Array<{ id: string; documentId: string; payload: { text: string } }>;
  };
  expect(listedBody.nodes.map((node) => node.payload.text)).toEqual(["EXCERPTTOKEN"]);

  const raw = await readFile(path.join(dataDir, "ws-1", "nodes.jsonl"), "utf8");
  expect(raw).toContain('"type":"excerpt"');
  expect(raw).toContain("EXCERPTTOKEN");
  expect(raw).toContain('"page":2');
});

test("an excerpt without a page and rectangle anchor is rejected", async () => {
  const response = await POST(
    excerptRequest({
      workspaceId: "ws-1",
      documentId: "doc-1",
      type: "excerpt",
      payload: { text: "no place" },
    }),
  );
  expect(response.status).toBe(400);
});

test("GET without a workspace id is rejected", async () => {
  const response = await GET(new NextRequest("http://localhost/api/nodes"));
  expect(response.status).toBe(400);
});
