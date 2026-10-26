"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EpubReader } from "@/components/epub-reader";
import { PdfReader } from "@/components/pdf-reader";
import { prefetchEpubRuntime } from "@/src/lib/epub/runtime";
import { LOCAL_WORKSPACE_ID } from "@/src/lib/workspace";

if (typeof window !== "undefined") {
  void prefetchEpubRuntime();
}

export function DocumentReader() {
  const params = useSearchParams();
  const documentId = params.get("documentId");
  const workspaceId = params.get("workspaceId") ?? LOCAL_WORKSPACE_ID;
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("无法读取文库");
        return (await response.json()) as {
          documents: Array<{ id: string; mediaType: string }>;
        };
      })
      .then((body) => {
        if (cancelled) return;
        const found = body.documents.find((item) => item.id === documentId);
        if (!found) {
          setError("找不到文档。");
          return;
        }
        setMediaType(found.mediaType);
      })
      .catch(() => {
        if (!cancelled) setError("无法打开文档。");
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, workspaceId]);

  if (!documentId) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p>缺少文档。</p>
        <Link className="text-sm underline" href="/">
          返回文库
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p role="alert">{error}</p>
        <Link className="text-sm underline" href="/">
          返回文库
        </Link>
      </main>
    );
  }

  if (mediaType === "pdf") return <PdfReader />;
  if (mediaType === "epub") {
    return <EpubReader documentId={documentId} workspaceId={workspaceId} />;
  }
  return <p className="px-6 py-10">正在打开文档…</p>;
}
