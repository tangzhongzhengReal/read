import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { resetDocumentStores } from "@/src/lib/store/documents";
import { GET, POST } from "./route";

let dataDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-api-"));
  process.env.READ_DATA_DIR = dataDir;
  resetDocumentStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  resetDocumentStores();
});

test("POST document metadata is listed by GET and stored as JSONL", async () => {
  const created = await POST(
    new NextRequest("http://localhost/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "ws-1",
        mediaType: "pdf",
        storageKey: "uploads/ws-1/fake.pdf",
        contentHash: "hash-1",
        title: "Fake PDF",
        meta: { fake: true },
      }),
    }),
  );

  expect(created.status).toBe(201);
  const createdBody = (await created.json()) as {
    document: { id: string; title: string; storageKey: string };
  };
  expect(createdBody.document.title).toBe("Fake PDF");
  expect(createdBody.document.storageKey).toBe("uploads/ws-1/fake.pdf");

  const listed = await GET(
    new NextRequest("http://localhost/api/documents?workspaceId=ws-1"),
  );
  expect(listed.status).toBe(200);
  const listedBody = (await listed.json()) as {
    documents: Array<{ id: string; title: string }>;
  };
  expect(listedBody.documents).toEqual([createdBody.document]);

  const raw = await readFile(
    path.join(dataDir, "ws-1", "documents.jsonl"),
    "utf8",
  );
  expect(raw).toContain("Fake PDF");
  expect(raw).toContain("uploads/ws-1/fake.pdf");
});

test("POST rejects incomplete document metadata", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "missing fields" }),
    }),
  );

  expect(response.status).toBe(400);
});

test("GET without a workspace id is rejected", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/documents"),
  );
  expect(response.status).toBe(400);
});

test("a workspace id that escapes the data directory is rejected", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/documents?workspaceId=../secrets"),
  );
  expect(response.status).toBe(400);
});
