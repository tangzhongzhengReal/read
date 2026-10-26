"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LOCAL_WORKSPACE_ID, mapPath, readerPath, reviewPath } from "@/src/lib/workspace";

type LibraryDocument = {
  id: string;
  workspaceId: string;
  title: string;
  mediaType: string;
};

type WorkspaceRecord = {
  id: string;
  name: string;
};

export function Library() {
  const params = useSearchParams();
  const router = useRouter();
  const workspaceId = params.get("workspaceId") || LOCAL_WORKSPACE_ID;
  const [workspaceName, setWorkspaceName] = useState("本地");
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [draftName, setDraftName] = useState("");
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [workspaceResponse, documentResponse] = await Promise.all([
          fetch("/api/workspaces"),
          fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`),
        ]);
        if (!workspaceResponse.ok || !documentResponse.ok) throw new Error("无法读取文库");
        const workspaceBody = (await workspaceResponse.json()) as { workspaces: WorkspaceRecord[] };
        const documentBody = (await documentResponse.json()) as { documents: LibraryDocument[] };
        if (cancelled) return;
        const current = workspaceBody.workspaces.find((workspace) => workspace.id === workspaceId);
        setWorkspaces(workspaceBody.workspaces);
        setWorkspaceName(current?.name ?? (workspaceId === LOCAL_WORKSPACE_ID ? "本地" : workspaceId));
        setDocuments(documentBody.documents);
      } catch {
        if (!cancelled) {
          setWorkspaceName(workspaceId === LOCAL_WORKSPACE_ID ? "本地" : workspaceId);
          setDocuments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function createWorkspace() {
    const name = draftName.trim();
    if (!name) return;
    setError(null);
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError("无法新建工作区。");
      return;
    }
    const body = (await response.json()) as { workspace: { id: string } };
    router.push(`/?workspaceId=${encodeURIComponent(body.workspace.id)}`);
  }

  async function onFile(file: File) {
    setError(null);
    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("file", file);
    const response = await fetch("/api/documents/upload", { method: "POST", body: form });
    if (!response.ok) {
      setError(response.status === 415 ? "只能导入 PDF 或 EPUB。" : "导入失败。");
      return;
    }
    const body = (await response.json()) as { document: { id: string; workspaceId: string } };
    window.location.assign(readerPath(body.document.id, body.document.workspaceId));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p data-testid="workspace-title" className="text-sm font-medium">
          {workspaceName}
        </p>
        <p data-testid="workspace-id" className="text-xs text-muted-foreground">
          {workspaceId}
        </p>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void createWorkspace();
        }}
      >
        <input
          data-testid="workspace-name"
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base sm:w-auto sm:min-w-40 sm:text-sm"
          value={draftName}
          placeholder="工作区名称"
          onChange={(event) => setDraftName(event.target.value)}
        />
        <button
          type="submit"
          data-testid="create-workspace"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
        >
          新建工作区
        </button>
      </form>
      {workspaces.length > 0 ? (
        <ul className="flex flex-wrap gap-2" data-testid="workspace-list">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <Link
                data-testid="workspace-link"
                className="text-sm underline"
                href={`/?workspaceId=${encodeURIComponent(workspace.id)}`}
              >
                {workspace.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link
          data-testid="open-mind-map"
          className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
          href={mapPath(workspaceId)}
        >
          脑图
        </Link>
        <Link
          data-testid="open-review"
          className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
          href={reviewPath(workspaceId)}
        >
          复习
        </Link>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          导入 PDF
          <input
            data-testid="upload-pdf"
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onFile(file);
            }}
          />
        </label>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          导入 EPUB
          <input
            data-testid="upload-epub"
            className="sr-only"
            type="file"
            accept="application/epub+zip,.epub"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onFile(file);
            }}
          />
        </label>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      {documents.length === 0 ? (
        <Card data-testid="library-empty">
          <CardHeader>
            <CardTitle>还没有文档</CardTitle>
            <CardDescription>
              导入 PDF 或 EPUB 后，可以在这里阅读、摘录，并回到原文。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">文库是空的。</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3" data-testid="library-list">
          {documents.map((document) => (
            <li key={document.id}>
              <Link
                data-testid="document-card"
                className="block min-h-11 rounded-xl bg-card px-4 py-3 text-sm break-words ring-1 ring-foreground/10"
                href={readerPath(document.id, document.workspaceId)}
              >
                {document.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
