import { expect, test } from "vitest";
import type { Node, Review } from "@/src/lib/models";
import {
  advanceReviewSchedule,
  initialReviewSchedule,
  isDueOnDay,
  presentReview,
} from "./schedule";

const now = new Date("2026-10-26T08:00:00.000Z");

test("a new review is due immediately on a one-day interval", () => {
  expect(initialReviewSchedule(now)).toEqual({
    dueAt: "2026-10-26T08:00:00.000Z",
    intervalDays: 1,
  });
});

test("marking a review done pushes the next due time by the current interval and doubles it", () => {
  expect(advanceReviewSchedule(1, now)).toEqual({
    dueAt: "2026-10-27T08:00:00.000Z",
    lastReviewedAt: "2026-10-26T08:00:00.000Z",
    intervalDays: 2,
  });
  expect(advanceReviewSchedule(16, now).intervalDays).toBe(32);
  expect(advanceReviewSchedule(32, now)).toMatchObject({
    dueAt: "2026-11-27T08:00:00.000Z",
    intervalDays: 32,
  });
});

test("today includes anything due through the end of the UTC day", () => {
  expect(isDueOnDay("2026-10-26T23:00:00.000Z", now)).toBe(true);
  expect(isDueOnDay("2026-10-25T00:00:00.000Z", now)).toBe(true);
  expect(isDueOnDay("2026-10-27T00:00:00.000Z", now)).toBe(false);
});

test("a presented review carries the node text and whether it is due today", () => {
  const review: Review = {
    id: "rev",
    workspaceId: "ws",
    nodeId: "note-1",
    dueAt: "2026-10-26T08:00:00.000Z",
    intervalDays: 1,
    createdAt: "2026-10-26T08:00:00.000Z",
    updatedAt: "2026-10-26T08:00:00.000Z",
  };
  const node: Node = {
    id: "note-1",
    workspaceId: "ws",
    type: "note",
    payload: { text: "spaced fact" },
    createdAt: "2026-10-26T08:00:00.000Z",
    updatedAt: "2026-10-26T08:00:00.000Z",
  };

  expect(presentReview(review, node, now)).toMatchObject({
    id: "rev",
    nodeId: "note-1",
    text: "spaced fact",
    nodeType: "note",
    due: true,
    intervalDays: 1,
  });

  const later = advanceReviewSchedule(review.intervalDays, now);
  expect(
    presentReview({ ...review, ...later, updatedAt: later.lastReviewedAt }, node, now).due,
  ).toBe(false);
});
