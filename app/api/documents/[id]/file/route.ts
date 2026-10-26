import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { assertWorkspaceId, getDocumentStore } from "@/src/lib/store/documents";
import { resolveUploadPath } from "@/src/lib/store/uploads";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspaceRaw = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceRaw) {
    return Response.json({ error: "workspaceId is required" }, { status: 400 });
  }

  let workspaceId: string;
  try {
    workspaceId = assertWorkspaceId(workspaceRaw);
  } catch (error) {
    return invalidWorkspace(error);
  }

  const document = await getDocumentStore(workspaceId).get(id);
  if (!document || document.workspaceId !== workspaceId || document.mediaType !== "pdf") {
    return Response.json({ error: "document not found" }, { status: 404 });
  }

  let filePath: string;
  try {
    filePath = resolveUploadPath(document.storageKey);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid storage key") {
      return Response.json({ error: "invalid storage key" }, { status: 400 });
    }
    throw error;
  }

  try {
    const bytes = await readFile(filePath);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(bytes.byteLength),
        "cache-control": "private, max-age=0",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "file not found" }, { status: 404 });
    }
    throw error;
  }
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
