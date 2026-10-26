import path from "node:path";
import { CodeRunSchema, type CodeRun } from "@/src/lib/models";
import { JsonlStore } from "./jsonl-store";
import { assertWorkspaceId, getDataDir } from "./documents";

const stores = new Map<string, JsonlStore<CodeRun>>();

export function codeRunFilePath(workspaceId: string): string {
  return path.join(getDataDir(), assertWorkspaceId(workspaceId), "code-runs.jsonl");
}

export function getCodeRunStore(workspaceId: string): JsonlStore<CodeRun> {
  const filePath = codeRunFilePath(workspaceId);
  const existing = stores.get(filePath);
  if (existing) return existing;
  const store = new JsonlStore({ filePath, schema: CodeRunSchema });
  stores.set(filePath, store);
  return store;
}

export function resetCodeRunStores(): void {
  stores.clear();
}
