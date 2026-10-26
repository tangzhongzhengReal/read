import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { NodeSchema } from "@/src/lib/models";
import { resetEdgeStores } from "@/src/lib/store/edges";
import { getNodeStore, resetNodeStores } from "@/src/lib/store/nodes";
import { DELETE, GET as GET_ONE, PATCH } from "./[id]/route";
import { GET, POST } from "./route";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-edges-"));
  process.env.READ_DATA_DIR = dataDir;
  resetNodeStores();
  resetEdgeStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetNodeStores();
  resetEdgeStores();
});

const now = "2026-10-26T00:00:00.000Z";

async function seedNode(id: string) {
  await getNodeStore("ws-1").append(
    NodeSchema.parse({
      id,
      workspaceId: "ws-1",
      type: "note",
      payload: { text: id },
      position: { x: 0, y: 0 },
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/edges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("edges can be created, listed, updated, deleted, and reloaded from JSONL", async () => {
  await seedNode("a");
  await seedNode("b");
  await seedNode("c");

  const created = await post({
    workspaceId: "ws-1",
    fromNodeId: "a",
    toNodeId: "b",
  });
  expect(created.status).toBe(201);
  const createdBody = (await created.json()) as {
    edge: { id: string; kind: string; fromNodeId: string; toNodeId: string };
  };
  expect(createdBody.edge.kind).toBe("relates");
  expect(createdBody.edge.fromNodeId).toBe("a");
  expect(createdBody.edge.toNodeId).toBe("b");

  const updated = await PATCH(
    new NextRequest(`http://localhost/api/edges/${createdBody.edge.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "ws-1",
        kind: "supports",
        toNodeId: "c",
      }),
    }),
    { params: Promise.resolve({ id: createdBody.edge.id }) },
  );
  expect(updated.status).toBe(200);
  const updatedBody = (await updated.json()) as {
    edge: { kind: string; toNodeId: string; fromNodeId: string };
  };
  expect(updatedBody.edge).toMatchObject({
    kind: "supports",
    fromNodeId: "a",
    toNodeId: "c",
  });

  resetEdgeStores();
  const listed = await GET(new NextRequest("http://localhost/api/edges?workspaceId=ws-1"));
  expect(listed.status).toBe(200);
  const listedBody = (await listed.json()) as {
    edges: Array<{ id: string; kind: string; toNodeId: string }>;
  };
  expect(listedBody.edges).toEqual([
    expect.objectContaining({ id: createdBody.edge.id, kind: "supports", toNodeId: "c" }),
  ]);

  const one = await GET_ONE(
    new NextRequest(
      `http://localhost/api/edges/${createdBody.edge.id}?workspaceId=ws-1`,
    ),
    { params: Promise.resolve({ id: createdBody.edge.id }) },
  );
  expect(one.status).toBe(200);

  const removed = await DELETE(
    new NextRequest(
      `http://localhost/api/edges/${createdBody.edge.id}?workspaceId=ws-1`,
      { method: "DELETE" },
    ),
    { params: Promise.resolve({ id: createdBody.edge.id }) },
  );
  expect(removed.status).toBe(204);

  resetEdgeStores();
  const afterDelete = await GET(new NextRequest("http://localhost/api/edges?workspaceId=ws-1"));
  const afterBody = (await afterDelete.json()) as { edges: unknown[] };
  expect(afterBody.edges).toEqual([]);

  const raw = await readFile(path.join(dataDir, "ws-1", "edges.jsonl"), "utf8");
  expect(raw).toContain('"deleted":true');
  expect(raw).toContain('"kind":"supports"');
});

test("edge writes reject a missing node, a self link, an empty patch, and a bad workspace", async () => {
  await seedNode("a");
  expect(
    (
      await post({
        workspaceId: "ws-1",
        fromNodeId: "a",
        toNodeId: "missing",
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await post({
        workspaceId: "ws-1",
        fromNodeId: "a",
        toNodeId: "a",
      })
    ).status,
  ).toBe(400);
  expect((await GET(new NextRequest("http://localhost/api/edges"))).status).toBe(400);
  expect(
    (await GET(new NextRequest("http://localhost/api/edges?workspaceId=../etc"))).status,
  ).toBe(400);

  const created = await post({ workspaceId: "ws-1", fromNodeId: "a", toNodeId: "a" });
  expect(created.status).toBe(400);

  await seedNode("b");
  const ok = await post({ workspaceId: "ws-1", fromNodeId: "a", toNodeId: "b" });
  const id = ((await ok.json()) as { edge: { id: string } }).edge.id;
  const empty = await PATCH(
    new NextRequest(`http://localhost/api/edges/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws-1" }),
    }),
    { params: Promise.resolve({ id }) },
  );
  expect(empty.status).toBe(400);

  const missing = await DELETE(
    new NextRequest("http://localhost/api/edges/nope?workspaceId=ws-1", { method: "DELETE" }),
    { params: Promise.resolve({ id: "nope" }) },
  );
  expect(missing.status).toBe(404);
});
