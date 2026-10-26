import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { ReviewCreateSchema, ReviewSchema } from "@/src/lib/models";
import { initialReviewSchedule, presentReview } from "@/src/lib/review/schedule";
import { assertWorkspaceId } from "@/src/lib/store/documents";
import { getNodeStore } from "@/src/lib/store/nodes";
import { getReviewStore } from "@/src/lib/store/reviews";

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

  const now = new Date();
  const [reviews, nodes] = await Promise.all([
    getReviewStore(workspaceId).list(),
    getNodeStore(workspaceId).list(),
  ]);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return Response.json({
    reviews: reviews.map((review) => presentReview(review, nodesById.get(review.nodeId), now)),
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = ReviewCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid review" }, { status: 400 });
  }

  let workspaceId: string;
  try {
    workspaceId = assertWorkspaceId(parsed.data.workspaceId);
  } catch (error) {
    return invalidWorkspace(error);
  }

  const node = await getNodeStore(workspaceId).get(parsed.data.nodeId);
  if (!node) return Response.json({ error: "node not found" }, { status: 404 });
  if (node.type !== "excerpt" && node.type !== "note") {
    return Response.json({ error: "only excerpts and notes can be reviewed" }, { status: 400 });
  }

  const store = getReviewStore(workspaceId);
  const existing = (await store.list()).find((review) => review.nodeId === node.id);
  const now = new Date();
  if (existing) {
    return Response.json({ review: presentReview(existing, node, now) });
  }

  const review = ReviewSchema.parse({
    id: randomUUID(),
    workspaceId,
    nodeId: node.id,
    ...initialReviewSchedule(now),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  await store.append(review);
  return Response.json({ review: presentReview(review, node, now) }, { status: 201 });
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
