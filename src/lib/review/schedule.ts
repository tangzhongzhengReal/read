import type { Node, Review } from "@/src/lib/models";

const DAY_MS = 24 * 60 * 60 * 1000;

export const INITIAL_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 32;

export type PresentedReview = {
  id: string;
  workspaceId: string;
  nodeId: string;
  dueAt: string;
  lastReviewedAt?: string;
  intervalDays: number;
  createdAt: string;
  updatedAt: string;
  due: boolean;
  nodeType: Node["type"];
  text: string;
};

export function initialReviewSchedule(now: Date): { dueAt: string; intervalDays: number } {
  return {
    dueAt: now.toISOString(),
    intervalDays: INITIAL_INTERVAL_DAYS,
  };
}

export function advanceReviewSchedule(
  intervalDays: number,
  reviewedAt: Date,
): { dueAt: string; lastReviewedAt: string; intervalDays: number } {
  const current = clampInterval(intervalDays);
  return {
    dueAt: new Date(reviewedAt.getTime() + current * DAY_MS).toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
    intervalDays: clampInterval(current * 2),
  };
}

export function isDueOnDay(dueAt: string, now: Date): boolean {
  const due = Date.parse(dueAt);
  if (Number.isNaN(due)) return false;
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23,
    59,
    59,
    999,
  );
  return due <= end;
}

export function presentReview(
  review: Review,
  node: Node | undefined,
  now: Date,
): PresentedReview {
  const text = node && typeof node.payload.text === "string" ? node.payload.text : "";
  return {
    id: review.id,
    workspaceId: review.workspaceId,
    nodeId: review.nodeId,
    dueAt: review.dueAt,
    ...(review.lastReviewedAt ? { lastReviewedAt: review.lastReviewedAt } : {}),
    intervalDays: review.intervalDays,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    due: isDueOnDay(review.dueAt, now),
    nodeType: node?.type ?? "note",
    text,
  };
}

function clampInterval(days: number): number {
  if (!Number.isFinite(days)) return INITIAL_INTERVAL_DAYS;
  const whole = Math.floor(days);
  if (whole < 1) return INITIAL_INTERVAL_DAYS;
  return Math.min(whole, MAX_INTERVAL_DAYS);
}
