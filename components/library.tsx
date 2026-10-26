"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LOCAL_WORKSPACE_ID, readerPath } from "@/src/lib/workspace";

type LibraryDocument = {
  id: string;
  workspaceId: string;
  title: string;
  mediaType: string;
};

export function Library() {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents?workspaceId=${encodeURIComponent(LOCAL_WORKSPACE_ID)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("无法读取文库");
        return (await response.json()) as { documents: LibraryDocument[] };
      })
      .then((body) => {
        if (!cancelled) setDocuments(body.documents);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onFile(file: File) {
    setError(null);
    const form = new FormData();
    form.set("workspaceId", LOCAL_WORKSPACE_ID);
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
      <div className="flex flex-wrap gap-3">
        <Link
          data-testid="open-mind-map"
          className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          href="/map"
        >
          脑图
        </Link>
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
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
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
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
                className="block rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10"
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
