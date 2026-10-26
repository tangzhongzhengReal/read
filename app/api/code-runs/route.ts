import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { executeQueuedCodeRun } from "@/src/lib/code-run/execute";
import {
  codePayloadSchema,
  CodeRunCreateSchema,
  CodeRunSchema,
  type CodeLanguage,
} from "@/src/lib/models";
import { getCodeRunStore } from "@/src/lib/store/code-runs";
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

  const nodeId = request.nextUrl.searchParams.get("nodeId");
  const runs = await getCodeRunStore(workspaceId).list();
  const filtered = nodeId ? runs.filter((run) => run.nodeId === nodeId) : runs;
  return Response.json({ runs: filtered });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = CodeRunCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid code run" }, { status: 400 });
  }

  let workspaceId: string;
  try {
    workspaceId = assertWorkspaceId(parsed.data.workspaceId);
  } catch (error) {
    return invalidWorkspace(error);
  }

  const node = await getNodeStore(workspaceId).get(parsed.data.nodeId);
  if (!node) return Response.json({ error: "node not found" }, { status: 404 });
  if (node.type !== "code") {
    return Response.json({ error: "node is not code" }, { status: 400 });
  }

  const payload = codePayloadSchema.safeParse(node.payload);
  if (!payload.success && (parsed.data.language === undefined || parsed.data.source === undefined)) {
    return Response.json({ error: "invalid code node" }, { status: 400 });
  }

  const language: CodeLanguage = parsed.data.language ?? payload.data?.language ?? "python";
  const source = parsed.data.source ?? payload.data?.source ?? "";
  const now = new Date().toISOString();
  const queued = CodeRunSchema.parse({
    id: randomUUID(),
    workspaceId,
    nodeId: node.id,
    status: "queued",
    language,
    source,
    stdin: parsed.data.stdin,
    createdAt: now,
    updatedAt: now,
  });
  await getCodeRunStore(workspaceId).append(queued);
  const run = await executeQueuedCodeRun(workspaceId, queued.id);
  return Response.json({ run }, { status: 201 });
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
