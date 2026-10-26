import { NextRequest } from "next/server";
import { getCodeRunStore } from "@/src/lib/store/code-runs";
import { assertWorkspaceId } from "@/src/lib/store/documents";

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
    if (error instanceof Error && error.message === "invalid workspace id") {
      return Response.json({ error: "invalid workspaceId" }, { status: 400 });
    }
    throw error;
  }

  const run = await getCodeRunStore(workspaceId).get(id);
  if (!run) return Response.json({ error: "code run not found" }, { status: 404 });
  return Response.json({ run });
}
