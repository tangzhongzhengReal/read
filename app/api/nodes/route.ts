import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { ExcerptCreateSchema, NodeSchema } from "@/src/lib/models";
import { assertWorkspaceId } from "@/src/lib/store/documents";
import { getNodeStore } from "@/src/lib/store/nodes";

export async function GET(request: NextRequest) {
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

  const documentId = request.nextUrl.searchParams.get("documentId");
  const nodes = await getNodeStore(workspaceId).list();
  const filtered = documentId
    ? nodes.filter((node) => node.documentId === documentId)
    : nodes;
  return Response.json({ nodes: filtered });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = ExcerptCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid excerpt" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const node = NodeSchema.parse({
    id: randomUUID(),
    workspaceId: parsed.data.workspaceId,
    documentId: parsed.data.documentId,
    type: "excerpt",
    payload: parsed.data.payload,
    anchor: parsed.data.anchor,
    createdAt: now,
    updatedAt: now,
  });

  try {
    await getNodeStore(node.workspaceId).append(node);
  } catch (error) {
    return invalidWorkspace(error);
  }

  return Response.json({ node }, { status: 201 });
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
