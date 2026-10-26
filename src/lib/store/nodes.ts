import path from "node:path";
import { NodeSchema, type Node } from "@/src/lib/models";
import { JsonlStore } from "./jsonl-store";
import { assertWorkspaceId, getDataDir } from "./documents";

const stores = new Map<string, JsonlStore<Node>>();

export function nodeFilePath(workspaceId: string): string {
  return path.join(getDataDir(), assertWorkspaceId(workspaceId), "nodes.jsonl");
}

export function getNodeStore(workspaceId: string): JsonlStore<Node> {
  const filePath = nodeFilePath(workspaceId);
  const existing = stores.get(filePath);
  if (existing) return existing;
  const store = new JsonlStore({ filePath, schema: NodeSchema });
  stores.set(filePath, store);
  return store;
}

export function resetNodeStores(): void {
  stores.clear();
}
