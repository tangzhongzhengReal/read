import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test } from "vitest";
import { resetDocumentStores } from "@/src/lib/store/documents";
import { POST } from "./route";

let dataDir = "";
let uploadsDir = "";

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "read-upload-data-"));
  uploadsDir = await mkdtemp(path.join(tmpdir(), "read-upload-files-"));
  process.env.READ_DATA_DIR = dataDir;
  process.env.READ_UPLOADS_DIR = uploadsDir;
  process.env.READ_MAX_UPLOAD_BYTES = "1024";
  resetDocumentStores();
});

afterEach(() => {
  delete process.env.READ_DATA_DIR;
  delete process.env.READ_UPLOADS_DIR;
  delete process.env.READ_MAX_UPLOAD_BYTES;
  resetDocumentStores();
});

function uploadRequest(options: {
  bytes: Uint8Array;
  filename: string;
  type: string;
  workspaceId?: string;
  title?: string;
}) {
  const form = new FormData();
  form.set("workspaceId", options.workspaceId ?? "ws-1");
  if (options.title !== undefined) form.set("title", options.title);
  form.set(
    "file",
    new File([Buffer.from(options.bytes)], options.filename, { type: options.type }),
  );
  return new NextRequest("http://localhost/api/documents/upload", {
    method: "POST",
    body: form,
  });
}

function minimalPdf(): Uint8Array {
  return new TextEncoder().encode(
    "%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n",
  );
}

test("rejects a non-pdf upload and writes no file or document row", async () => {
  const response = await POST(
    uploadRequest({
      bytes: new TextEncoder().encode("hello notes"),
      filename: "notes.txt",
      type: "text/plain",
    }),
  );

  expect(response.status).toBe(415);
  await expect(stat(path.join(uploadsDir, "ws-1"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  await expect(
    readFile(path.join(dataDir, "ws-1", "documents.jsonl"), "utf8"),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

test("rejects a file labeled pdf when the bytes are not a pdf", async () => {
  const response = await POST(
    uploadRequest({
      bytes: new TextEncoder().encode("not really a pdf"),
      filename: "fake.pdf",
      type: "application/pdf",
    }),
  );

  expect(response.status).toBe(415);
});

test("rejects an epub upload", async () => {
  const response = await POST(
    uploadRequest({
      bytes: new TextEncoder().encode("PK epub"),
      filename: "book.epub",
      type: "application/epub+zip",
    }),
  );

  expect(response.status).toBe(415);
});

test("accepts a pdf, stores the file, and records storageKey", async () => {
  const bytes = minimalPdf();
  const response = await POST(
    uploadRequest({
      bytes,
      filename: "Sample Paper.pdf",
      type: "application/pdf",
      title: "Sample Paper",
    }),
  );

  expect(response.status).toBe(201);
  const body = (await response.json()) as {
    document: {
      id: string;
      workspaceId: string;
      mediaType: string;
      storageKey: string;
      contentHash: string;
      title: string;
    };
  };
  expect(body.document.workspaceId).toBe("ws-1");
  expect(body.document.mediaType).toBe("pdf");
  expect(body.document.title).toBe("Sample Paper");
  expect(body.document.storageKey).toBe(`ws-1/${body.document.id}.pdf`);
  expect(body.document.contentHash).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );

  const stored = await readFile(path.join(uploadsDir, body.document.storageKey));
  expect(stored.equals(Buffer.from(bytes))).toBe(true);

  const raw = await readFile(
    path.join(dataDir, "ws-1", "documents.jsonl"),
    "utf8",
  );
  expect(raw).toContain(body.document.storageKey);
  expect(raw).toContain(body.document.contentHash);
});

test("uses the filename as the title when the form omits one", async () => {
  const response = await POST(
    uploadRequest({
      bytes: minimalPdf(),
      filename: "chapter.pdf",
      type: "application/pdf",
    }),
  );

  expect(response.status).toBe(201);
  const body = (await response.json()) as { document: { title: string } };
  expect(body.document.title).toBe("chapter");
});

test("rejects a workspace id that escapes the uploads directory", async () => {
  const response = await POST(
    uploadRequest({
      bytes: minimalPdf(),
      filename: "a.pdf",
      type: "application/pdf",
      workspaceId: "../secrets",
    }),
  );

  expect(response.status).toBe(400);
});

test("rejects an upload larger than the configured limit", async () => {
  const bytes = new Uint8Array(2048);
  bytes.set(new TextEncoder().encode("%PDF-1.1\n"), 0);
  const response = await POST(
    uploadRequest({
      bytes,
      filename: "big.pdf",
      type: "application/pdf",
    }),
  );

  expect(response.status).toBe(413);
});
