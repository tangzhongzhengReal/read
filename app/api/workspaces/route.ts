import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { WorkspaceCreateSchema, WorkspaceSchema } from "@/src/lib/models";
import { getWorkspaceStore } from "@/src/lib/store/workspaces";

export async function GET() {
  const workspaces = await getWorkspaceStore().list();
  return Response.json({ workspaces });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = WorkspaceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid workspace" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const workspace = WorkspaceSchema.parse({
    id: randomUUID(),
    name: parsed.data.name,
    createdAt: now,
    updatedAt: now,
  });
  await getWorkspaceStore().append(workspace);
  return Response.json({ workspace }, { status: 201 });
}
