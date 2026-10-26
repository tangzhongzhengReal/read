import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { NextRequest } from "next/server";
import { isEpubUpload } from "@/src/lib/epub/epub-file";
import { DocumentSchema } from "@/src/lib/models";
import { assertWorkspaceId, getDocumentStore } from "@/src/lib/store/documents";
import { maxUploadBytes, writeUpload } from "@/src/lib/store/uploads";

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid form" }, { status: 400 });
  }

  const workspaceRaw = form.get("workspaceId");
  const file = form.get("file");
  if (typeof workspaceRaw !== "string" || workspaceRaw.length === 0 || !(file instanceof File)) {
    return Response.json(
      { error: "file and workspaceId are required" },
      { status: 400 },
    );
  }

  let workspaceId: string;
  try {
    workspaceId = assertWorkspaceId(workspaceRaw);
  } catch (error) {
    return invalidWorkspace(error);
  }

  if (file.size > maxUploadBytes()) {
    return Response.json({ error: "file is too large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = mediaTypeOf(bytes, file);
  if (!mediaType) {
    return Response.json({ error: "only pdf and epub files are accepted" }, { status: 415 });
  }

  const id = randomUUID();
  const storageKey = `${workspaceId}/${id}.${mediaType}`;
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const now = new Date().toISOString();
  const document = DocumentSchema.parse({
    id,
    workspaceId,
    mediaType,
    storageKey,
    contentHash,
    title: documentTitle(form.get("title"), file.name, mediaType),
    createdAt: now,
    updatedAt: now,
  });

  await writeUpload(storageKey, bytes);
  try {
    await getDocumentStore(workspaceId).append(document);
  } catch (error) {
    return invalidWorkspace(error);
  }

  return Response.json({ document }, { status: 201 });
}

function isPdf(bytes: Uint8Array, mediaType: string): boolean {
  if (mediaType.toLowerCase() !== "application/pdf") return false;
  if (bytes.byteLength < 5) return false;
  return Buffer.from(bytes.subarray(0, 5)).toString("utf8") === "%PDF-";
}

function mediaTypeOf(bytes: Uint8Array, file: File): "pdf" | "epub" | null {
  if (isPdf(bytes, file.type)) return "pdf";
  if (isEpubUpload(bytes, file)) return "epub";
  return null;
}

function documentTitle(
  raw: FormDataEntryValue | null,
  filename: string,
  mediaType: "pdf" | "epub",
): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const extension = mediaType === "pdf" ? /\.pdf$/i : /\.epub$/i;
  const fallback = mediaType === "pdf" ? "未命名 PDF" : "未命名 EPUB";
  const base = path.basename(filename).replace(extension, "").trim();
  return base || fallback;
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
