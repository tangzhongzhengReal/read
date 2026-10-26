import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { NodeSchema } from "@/src/lib/models";
import { getNodeStore, resetNodeStores } from "@/src/lib/store/nodes";
import { GET } from "../route";
import { PATCH } from "./route";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-node-patch-"));
  process.env.READ_DATA_DIR = dataDir;
  resetNodeStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetNodeStores();
});

const now = "2026-10-26T00:00:00.000Z";

async function seedExcerpt() {
  await getNodeStore("ws-1").append(
    NodeSchema.parse({
      id: "excerpt-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      type: "excerpt",
      payload: { text: "quoted" },
      anchor: { page: 2, rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }] },
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function patch(id: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/nodes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

test("moving a node appends a new JSONL row and keeps the excerpt anchor", async () => {
  await seedExcerpt();
  const response = await patch("excerpt-1", {
    workspaceId: "ws-1",
    position: { x: 120, y: 240 },
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    node: {
      position: { x: number; y: number };
      payload: { text: string };
      anchor: { page: number };
      type: string;
    };
  };
  expect(body.node.position).toEqual({ x: 120, y: 240 });
  expect(body.node.payload.text).toBe("quoted");
  expect(body.node.anchor.page).toBe(2);
  expect(body.node.type).toBe("excerpt");

  resetNodeStores();
  const listed = await GET(new NextRequest("http://localhost/api/nodes?workspaceId=ws-1"));
  const listedBody = (await listed.json()) as {
    nodes: Array<{ id: string; position?: { x: number; y: number } }>;
  };
  expect(listedBody.nodes.find((node) => node.id === "excerpt-1")?.position).toEqual({
    x: 120,
    y: 240,
  });

  const raw = await readFile(path.join(dataDir, "ws-1", "nodes.jsonl"), "utf8");
  expect(raw.trim().split("\n")).toHaveLength(2);
});

test("a code payload can be replaced and a missing node is 404", async () => {
  await getNodeStore("ws-1").append(
    NodeSchema.parse({
      id: "code-1",
      workspaceId: "ws-1",
      type: "code",
      payload: { language: "python", source: "print(1)" },
      createdAt: now,
      updatedAt: now,
    }),
  );
  const response = await patch("code-1", {
    workspaceId: "ws-1",
    payload: { language: "javascript", source: "console.log(1+1)" },
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    node: { payload: { language: string; source: string } };
  };
  expect(body.node.payload).toEqual({
    language: "javascript",
    source: "console.log(1+1)",
  });

  const missing = await patch("missing", {
    workspaceId: "ws-1",
    position: { x: 1, y: 2 },
  });
  expect(missing.status).toBe(404);
});

test("an empty patch and an invalid position are rejected", async () => {
  await seedExcerpt();
  expect((await patch("excerpt-1", { workspaceId: "ws-1" })).status).toBe(400);
  expect(
    (await patch("excerpt-1", { workspaceId: "ws-1", position: { x: "nope", y: 1 } })).status,
  ).toBe(400);
});
