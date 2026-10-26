import { NextRequest } from "next/server";
import { ReviewSchema, ReviewUpdateSchema } from "@/src/lib/models";
import { advanceReviewSchedule, presentReview } from "@/src/lib/review/schedule";
import { assertWorkspaceId } from "@/src/lib/store/documents";
import { getNodeStore } from "@/src/lib/store/nodes";
import { getReviewStore } from "@/src/lib/store/reviews";

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

  const parsed = ReviewUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid review" }, { status: 400 });
  }

  let workspaceId: string;
  try {
    workspaceId = assertWorkspaceId(parsed.data.workspaceId);
  } catch (error) {
    return invalidWorkspace(error);
  }

  const store = getReviewStore(workspaceId);
  const current = await store.get(id);
  if (!current || current.workspaceId !== workspaceId) {
    return Response.json({ error: "review not found" }, { status: 404 });
  }

  const reviewedAt = new Date();
  const next = advanceReviewSchedule(current.intervalDays, reviewedAt);
  const review = ReviewSchema.parse({
    ...current,
    ...next,
    updatedAt: next.lastReviewedAt,
  });
  await store.append(review);
  const node = await getNodeStore(workspaceId).get(review.nodeId);
  return Response.json({ review: presentReview(review, node, reviewedAt) });
}

function invalidWorkspace(error: unknown): Response {
  if (error instanceof Error && error.message === "invalid workspace id") {
    return Response.json({ error: "invalid workspaceId" }, { status: 400 });
  }
  throw error;
}
