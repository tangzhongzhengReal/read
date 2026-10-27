export const LOCAL_WORKSPACE_ID = "local";

export function readerPath(documentId: string, workspaceId: string): string {
  const params = new URLSearchParams({ documentId, workspaceId });
  return `/read?${params.toString()}`;
}

export function libraryPath(workspaceId: string): string {
  return workspacePath("/", workspaceId);
}

export function mapPath(workspaceId: string): string {
  return workspacePath("/map", workspaceId);
}

export function reviewPath(workspaceId: string): string {
  return workspacePath("/review", workspaceId);
}

export function studyPath(workspaceId: string, documentId?: string): string {
  const params = new URLSearchParams();
  if (documentId) params.set("doc", documentId);
  const query = params.toString();
  return query
    ? `/w/${encodeURIComponent(workspaceId)}?${query}`
    : `/w/${encodeURIComponent(workspaceId)}`;
}

function workspacePath(pathname: string, workspaceId: string): string {
  if (workspaceId === LOCAL_WORKSPACE_ID) return pathname;
  return `${pathname}?${new URLSearchParams({ workspaceId }).toString()}`;
}
