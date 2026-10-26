import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { DocumentCreateSchema, DocumentSchema } from "@/src/lib/models";
import { getDocumentStore } from "@/src/lib/store/documents";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return Response.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const documents = await getDocumentStore(workspaceId).list();
    return Response.json({ documents });
  } catch (error) {
    return invalidWorkspace(error);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = DocumentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid document" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const document = DocumentSchema.parse({
    ...parsed.data,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  });

  try {
    await getDocumentStore(document.workspaceId).append(document);
  } catch (error) {
    return invalidWorkspace(error);
  }

  return Response.json({ document }, { status: 201 });
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
