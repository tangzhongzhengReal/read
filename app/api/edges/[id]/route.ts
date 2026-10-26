import { NextRequest } from "next/server";
import { EdgeSchema, EdgeUpdateSchema } from "@/src/lib/models";
import { assertWorkspaceId } from "@/src/lib/store/documents";
import { getEdgeStore } from "@/src/lib/store/edges";
import { getNodeStore } from "@/src/lib/store/nodes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspaceId = workspaceFrom(request.nextUrl.searchParams.get("workspaceId"));
  if (workspaceId instanceof Response) return workspaceId;

  const edge = await getEdgeStore(workspaceId).get(id);
  if (!edge) return Response.json({ error: "edge not found" }, { status: 404 });
  return Response.json({ edge });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = EdgeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid edge" }, { status: 400 });
  }

  const workspaceId = workspaceFrom(parsed.data.workspaceId);
  if (workspaceId instanceof Response) return workspaceId;

  const store = getEdgeStore(workspaceId);
  const current = await store.get(id);
  if (!current) return Response.json({ error: "edge not found" }, { status: 404 });

  const fromNodeId = parsed.data.fromNodeId ?? current.fromNodeId;
  const toNodeId = parsed.data.toNodeId ?? current.toNodeId;
  if (fromNodeId === toNodeId) {
    return Response.json({ error: "edge endpoints must differ" }, { status: 400 });
  }

  const nodes = getNodeStore(workspaceId);
  const [fromNode, toNode] = await Promise.all([nodes.get(fromNodeId), nodes.get(toNodeId)]);
  if (!fromNode || !toNode) {
    return Response.json({ error: "node not found" }, { status: 404 });
  }

  const edge = EdgeSchema.parse({
    ...current,
    fromNodeId,
    toNodeId,
    kind: parsed.data.kind ?? current.kind,
    updatedAt: new Date().toISOString(),
  });
  await store.append(edge);
  return Response.json({ edge });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspaceId = workspaceFrom(request.nextUrl.searchParams.get("workspaceId"));
  if (workspaceId instanceof Response) return workspaceId;

  const store = getEdgeStore(workspaceId);
  const current = await store.get(id);
  if (!current) return Response.json({ error: "edge not found" }, { status: 404 });
  await store.softDelete(id);
  return new Response(null, { status: 204 });
}

function workspaceFrom(value: string | null): string | Response {
  if (!value) return Response.json({ error: "workspaceId is required" }, { status: 400 });
  try {
    return assertWorkspaceId(value);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid workspace id") {
      return Response.json({ error: "invalid workspaceId" }, { status: 400 });
    }
    throw error;
  }
}
