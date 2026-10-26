import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { buildTextEpub, SAMPLE_EPUB_CHAPTER_ONE } from "@/src/lib/epub/text-epub";
import { DocumentSchema } from "@/src/lib/models";
import { getDocumentStore, resetDocumentStores } from "@/src/lib/store/documents";
import { POST } from "../../upload/route";
import { GET } from "./route";

let dataDir = "";
let uploadsDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-file-data-"));
  uploadsDir = await mkdtemp(path.join(tmpdir(), "read-file-uploads-"));
  process.env.READ_DATA_DIR = dataDir;
  process.env.READ_UPLOADS_DIR = uploadsDir;
  resetDocumentStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  delete process.env.READ_UPLOADS_DIR;
  resetDocumentStores();
});

function uploadPdf(workspaceId = "ws-1") {
  const bytes = new TextEncoder().encode(
    "%PDF-1.1\n1 0 obj<< /Type /Catalog >>endobj\n%%EOF\n",
  );
  const form = new FormData();
  form.set("workspaceId", workspaceId);
  form.set("title", "Sample");
  form.set("file", new File([Buffer.from(bytes)], "sample.pdf", { type: "application/pdf" }));
  return {
    bytes,
    request: new NextRequest("http://localhost/api/documents/upload", {
      method: "POST",
      body: form,
    }),
  };
}

function fileRequest(id: string, workspaceId: string | null) {
  const query = workspaceId === null ? "" : `?workspaceId=${encodeURIComponent(workspaceId)}`;
  return new NextRequest(`http://localhost/api/documents/${id}/file${query}`);
}

test("GET returns the stored pdf bytes", async () => {
  const { bytes, request } = uploadPdf();
  const created = await POST(request);
  expect(created.status).toBe(201);
  const { document } = (await created.json()) as { document: { id: string } };

  const response = await GET(fileRequest(document.id, "ws-1"), {
    params: Promise.resolve({ id: document.id }),
  });

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/pdf");
  const body = Buffer.from(await response.arrayBuffer());
  expect(body.equals(Buffer.from(bytes))).toBe(true);
});

test("GET returns the stored epub bytes", async () => {
  const bytes = buildTextEpub([SAMPLE_EPUB_CHAPTER_ONE]);
  const form = new FormData();
  form.set("workspaceId", "ws-1");
  form.set("title", "Sample EPUB");
  form.set(
    "file",
    new File([Buffer.from(bytes)], "sample.epub", { type: "application/epub+zip" }),
  );
  const created = await POST(
    new NextRequest("http://localhost/api/documents/upload", { method: "POST", body: form }),
  );
  expect(created.status).toBe(201);
  const { document } = (await created.json()) as { document: { id: string } };

  const response = await GET(fileRequest(document.id, "ws-1"), {
    params: Promise.resolve({ id: document.id }),
  });

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/epub+zip");
  const body = Buffer.from(await response.arrayBuffer());
  expect(body.equals(Buffer.from(bytes))).toBe(true);
});

test("GET missing document is 404", async () => {
  const response = await GET(fileRequest("missing", "ws-1"), {
    params: Promise.resolve({ id: "missing" }),
  });
  expect(response.status).toBe(404);
});

test("GET without a workspace id is rejected", async () => {
  const response = await GET(fileRequest("doc", null), {
    params: Promise.resolve({ id: "doc" }),
  });
  expect(response.status).toBe(400);
});

test("GET refuses a storage key that escapes the uploads directory", async () => {
  const outside = path.join(path.dirname(uploadsDir), "secret.pdf");
  await writeFile(outside, "%PDF-1.1\nsecret\n");
  const now = "2026-10-26T00:00:00.000Z";
  await getDocumentStore("ws-1").append(
    DocumentSchema.parse({
      id: "doc-1",
      workspaceId: "ws-1",
      mediaType: "pdf",
      storageKey: "../secret.pdf",
      contentHash: "abc",
      title: "Escape",
      createdAt: now,
      updatedAt: now,
    }),
  );

  const response = await GET(fileRequest("doc-1", "ws-1"), {
    params: Promise.resolve({ id: "doc-1" }),
  });

  expect(response.status).toBe(400);
});
