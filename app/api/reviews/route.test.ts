import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { NodeSchema } from "@/src/lib/models";
import { getNodeStore, resetNodeStores } from "@/src/lib/store/nodes";
import { resetReviewStores } from "@/src/lib/store/reviews";
import { PATCH } from "./[id]/route";
import { GET, POST } from "./route";

let dataDir = "";
const now = "2026-10-26T00:00:00.000Z";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-reviews-"));
  process.env.READ_DATA_DIR = dataDir;
  resetNodeStores();
  resetReviewStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetNodeStores();
  resetReviewStores();
});

async function seedNode(id: string, type: "note" | "excerpt" | "code", text = id) {
  await getNodeStore("ws-1").append(
    NodeSchema.parse({
      id,
      workspaceId: "ws-1",
      type,
      payload:
        type === "code"
          ? { language: "python", source: "print(1)" }
          : { text },
      ...(type === "excerpt"
        ? {
            documentId: "doc-1",
            anchor: { page: 2, rects: [{ x: 0, y: 0, width: 0.2, height: 0.1 }] },
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("an excerpt or note can be reviewed, checked off, and reloaded from JSONL", async () => {
  await seedNode("note-1", "note", "spaced fact");
  await seedNode("excerpt-1", "excerpt", "quoted line");

  const created = await post({ workspaceId: "ws-1", nodeId: "note-1" });
  expect(created.status).toBe(201);
  const createdBody = (await created.json()) as {
    review: {
      id: string;
      nodeId: string;
      text: string;
      nodeType: string;
      due: boolean;
      intervalDays: number;
      dueAt: string;
    };
  };
  expect(createdBody.review).toMatchObject({
    nodeId: "note-1",
    text: "spaced fact",
    nodeType: "note",
    due: true,
    intervalDays: 1,
  });

  const excerpt = await post({ workspaceId: "ws-1", nodeId: "excerpt-1" });
  expect(excerpt.status).toBe(201);

  const checked = await PATCH(
    new NextRequest(`http://localhost/api/reviews/${createdBody.review.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws-1", reviewed: true }),
    }),
    { params: Promise.resolve({ id: createdBody.review.id }) },
  );
  expect(checked.status).toBe(200);
  const checkedBody = (await checked.json()) as {
    review: {
      due: boolean;
      intervalDays: number;
      dueAt: string;
      lastReviewedAt: string;
      text: string;
    };
  };
  expect(checkedBody.review.due).toBe(false);
  expect(checkedBody.review.intervalDays).toBe(2);
  expect(checkedBody.review.text).toBe("spaced fact");
  expect(Date.parse(checkedBody.review.dueAt) - Date.parse(checkedBody.review.lastReviewedAt)).toBe(
    24 * 60 * 60 * 1000,
  );

  resetReviewStores();
  const listed = await GET(new NextRequest("http://localhost/api/reviews?workspaceId=ws-1"));
  expect(listed.status).toBe(200);
  const listedBody = (await listed.json()) as {
    reviews: Array<{ nodeId: string; due: boolean; lastReviewedAt?: string }>;
  };
  const note = listedBody.reviews.find((review) => review.nodeId === "note-1");
  const quote = listedBody.reviews.find((review) => review.nodeId === "excerpt-1");
  expect(note).toMatchObject({ due: false });
  expect(note?.lastReviewedAt).toBeTruthy();
  expect(quote).toMatchObject({ due: true });

  const raw = await readFile(path.join(dataDir, "ws-1", "reviews.jsonl"), "utf8");
  expect(raw).toContain("note-1");
  expect(raw).toContain("excerpt-1");
  expect(raw).toContain('"lastReviewedAt"');
});

test("reviewing the same node twice returns the existing item", async () => {
  await seedNode("note-1", "note", "once");
  const first = await post({ workspaceId: "ws-1", nodeId: "note-1" });
  const second = await post({ workspaceId: "ws-1", nodeId: "note-1" });
  expect(first.status).toBe(201);
  expect(second.status).toBe(200);
  const firstBody = (await first.json()) as { review: { id: string } };
  const secondBody = (await second.json()) as { review: { id: string } };
  expect(secondBody.review.id).toBe(firstBody.review.id);

  const listed = await GET(new NextRequest("http://localhost/api/reviews?workspaceId=ws-1"));
  const listedBody = (await listed.json()) as { reviews: unknown[] };
  expect(listedBody.reviews).toHaveLength(1);
});

test("code nodes and missing nodes cannot be reviewed", async () => {
  await seedNode("code-1", "code");
  const code = await post({ workspaceId: "ws-1", nodeId: "code-1" });
  expect(code.status).toBe(400);

  const missing = await post({ workspaceId: "ws-1", nodeId: "missing" });
  expect(missing.status).toBe(404);

  const checked = await PATCH(
    new NextRequest("http://localhost/api/reviews/missing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws-1", reviewed: true }),
    }),
    { params: Promise.resolve({ id: "missing" }) },
  );
  expect(checked.status).toBe(404);
});

test("review requests require a workspace and a real node id", async () => {
  const missingWorkspace = await GET(new NextRequest("http://localhost/api/reviews"));
  expect(missingWorkspace.status).toBe(400);

  const badWorkspace = await post({ workspaceId: "../etc", nodeId: "note-1" });
  expect(badWorkspace.status).toBe(400);

  const badBody = await post({ workspaceId: "ws-1" });
  expect(badBody.status).toBe(400);
});
