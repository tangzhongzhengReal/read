import path from "node:path";
import { EdgeSchema, type Edge } from "@/src/lib/models";
import { JsonlStore } from "./jsonl-store";
import { assertWorkspaceId, getDataDir } from "./documents";

const stores = new Map<string, JsonlStore<Edge>>();

export function edgeFilePath(workspaceId: string): string {
  return path.join(getDataDir(), assertWorkspaceId(workspaceId), "edges.jsonl");
}

export function getEdgeStore(workspaceId: string): JsonlStore<Edge> {
  const filePath = edgeFilePath(workspaceId);
  const existing = stores.get(filePath);
  if (existing) return existing;
  const store = new JsonlStore({ filePath, schema: EdgeSchema });
  stores.set(filePath, store);
  return store;
}

export function resetEdgeStores(): void {
  stores.clear();
}
