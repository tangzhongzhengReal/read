import path from "node:path";
import { WorkspaceSchema, type Workspace } from "@/src/lib/models";
import { JsonlStore } from "./jsonl-store";
import { getDataDir } from "./documents";

const stores = new Map<string, JsonlStore<Workspace>>();

export function workspaceFilePath(): string {
  return path.join(getDataDir(), "workspaces.jsonl");
}

export function getWorkspaceStore(): JsonlStore<Workspace> {
  const filePath = workspaceFilePath();
  const existing = stores.get(filePath);
  if (existing) return existing;
  const store = new JsonlStore({ filePath, schema: WorkspaceSchema });
  stores.set(filePath, store);
  return store;
}

export function resetWorkspaceStores(): void {
  stores.clear();
}
