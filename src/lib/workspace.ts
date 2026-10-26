export const LOCAL_WORKSPACE_ID = "local";

export function readerPath(documentId: string, workspaceId: string): string {
  const params = new URLSearchParams({ documentId, workspaceId });
  return `/read?${params.toString()}`;
}
