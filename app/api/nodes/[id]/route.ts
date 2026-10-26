import { NextRequest } from "next/server";
import {
  codePayloadSchema,
  excerptPayloadSchema,
  NodeSchema,
  NodeUpdateSchema,
  notePayloadSchema,
  type Node,
} from "@/src/lib/models";
import { assertWorkspaceId } from "@/src/lib/store/documents";
import { getNodeStore } from "@/src/lib/store/nodes";

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

  const parsed = NodeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid node" }, { status: 400 });
  }

  let workspaceId: string;
  try {
    workspaceId = assertWorkspaceId(parsed.data.workspaceId);
  } catch (error) {
    return invalidWorkspace(error);
  }

  const store = getNodeStore(workspaceId);
  const current = await store.get(id);
  if (!current || current.workspaceId !== workspaceId) {
    return Response.json({ error: "node not found" }, { status: 404 });
  }

  let payload = current.payload;
  if (parsed.data.payload) {
    const checked = payloadFor(current.type, parsed.data.payload);
    if (!checked) {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }
    payload = checked;
  }

  const node = NodeSchema.parse({
    ...current,
    payload,
    position: parsed.data.position ?? current.position,
    updatedAt: new Date().toISOString(),
  });
  await store.append(node);
  return Response.json({ node });
}

function payloadFor(type: Node["type"], payload: Record<string, unknown>): Record<string, unknown> | null {
  if (type === "note") {
    const parsed = notePayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }
  if (type === "code") {
    const parsed = codePayloadSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }
  const parsed = excerptPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
