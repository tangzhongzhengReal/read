import path from "node:path";
import { ReviewSchema, type Review } from "@/src/lib/models";
import { JsonlStore } from "./jsonl-store";
import { assertWorkspaceId, getDataDir } from "./documents";

const stores = new Map<string, JsonlStore<Review>>();

export function reviewFilePath(workspaceId: string): string {
  return path.join(getDataDir(), assertWorkspaceId(workspaceId), "reviews.jsonl");
}

export function getReviewStore(workspaceId: string): JsonlStore<Review> {
  const filePath = reviewFilePath(workspaceId);
  const existing = stores.get(filePath);
  if (existing) return existing;
  const store = new JsonlStore({ filePath, schema: ReviewSchema });
  stores.set(filePath, store);
  return store;
}

export function resetReviewStores(): void {
  stores.clear();
}
