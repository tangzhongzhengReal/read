import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { EdgeCreateSchema, EdgeSchema } from "@/src/lib/models";
import { assertWorkspaceId } from "@/src/lib/store/documents";
import { getEdgeStore } from "@/src/lib/store/edges";
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

  const edges = await getEdgeStore(workspaceId).list();
  return Response.json({ edges });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = EdgeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid edge" }, { status: 400 });
  }
  if (parsed.data.fromNodeId === parsed.data.toNodeId) {
    return Response.json({ error: "edge endpoints must differ" }, { status: 400 });
  }

  let workspaceId: string;
  try {
    workspaceId = assertWorkspaceId(parsed.data.workspaceId);
  } catch (error) {
    return invalidWorkspace(error);
  }

  const nodes = getNodeStore(workspaceId);
  const [fromNode, toNode] = await Promise.all([
    nodes.get(parsed.data.fromNodeId),
    nodes.get(parsed.data.toNodeId),
  ]);
  if (!fromNode || !toNode) {
    return Response.json({ error: "node not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const edge = EdgeSchema.parse({
    id: randomUUID(),
    workspaceId,
    fromNodeId: parsed.data.fromNodeId,
    toNodeId: parsed.data.toNodeId,
    kind: parsed.data.kind ?? "relates",
    createdAt: now,
    updatedAt: now,
  });
  await getEdgeStore(workspaceId).append(edge);
  return Response.json({ edge }, { status: 201 });
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
