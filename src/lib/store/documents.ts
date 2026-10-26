import path from "node:path";
import { DocumentSchema, type Document } from "@/src/lib/models";
import { JsonlStore } from "./jsonl-store";

const stores = new Map<string, JsonlStore<Document>>();

export function getDataDir(): string {
  return process.env.READ_DATA_DIR ?? path.join(process.cwd(), "data");
}

export function assertWorkspaceId(workspaceId: string): string {
  if (!/^[\w-]+$/.test(workspaceId)) {
    throw new Error("invalid workspace id");
  }
  return workspaceId;
}

export function documentFilePath(workspaceId: string): string {
  return path.join(getDataDir(), assertWorkspaceId(workspaceId), "documents.jsonl");
}

export function getDocumentStore(workspaceId: string): JsonlStore<Document> {
  const filePath = documentFilePath(workspaceId);
  const existing = stores.get(filePath);
  if (existing) return existing;
  const store = new JsonlStore({ filePath, schema: DocumentSchema });
  stores.set(filePath, store);
  return store;
}

export function resetDocumentStores(): void {
  stores.clear();
}
