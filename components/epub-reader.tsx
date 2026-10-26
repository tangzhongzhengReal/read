"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Book, Rendition } from "epubjs";
import { Button } from "@/components/ui/button";
import { libraryPath, mapPath, reviewPath } from "@/src/lib/workspace";

type EpubExcerpt = {
  id: string;
  payload: { text: string };
  anchor: { cfi: string };
};

type EpubContents = {
  window: Window;
  cfiFromRange: (range: Range) => string;
};

type EpubLocation = {
  atStart?: boolean;
  atEnd?: boolean;
  start?: { href?: string };
};

export function EpubReader({
  documentId,
  workspaceId,
}: {
  documentId: string;
  workspaceId: string;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [title, setTitle] = useState("EPUB");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excerpts, setExcerpts] = useState<EpubExcerpt[]>([]);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let cancelled = false;
    let book: Book | null = null;

    void (async () => {
      const epubjs = await import("epubjs");
      const [fileResponse, listResponse] = await Promise.all([
        fetch(
          `/api/documents/${encodeURIComponent(documentId)}/file?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
        fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`),
      ]);
      if (!fileResponse.ok) throw new Error("无法打开 EPUB");
      if (listResponse.ok) {
        const list = (await listResponse.json()) as {
          documents: Array<{ id: string; title: string }>;
        };
        const found = list.documents.find((item) => item.id === documentId);
        if (found && !cancelled) setTitle(found.title);
      }
      const data = await fileResponse.arrayBuffer();
      if (cancelled) return;
      book = epubjs.default(data, { replacements: "none" });
      await book.ready;
      if (cancelled) {
        book.destroy();
        return;
      }
      const width = viewer.clientWidth || 720;
      const height = viewer.clientHeight || 640;
      const rendition = book.renderTo(viewer, {
        width,
        height,
        flow: "scrolled-doc",
        spread: "none",
        manager: "default",
      });
      if (cancelled) {
        rendition.destroy();
        book.destroy();
        return;
      }
      renditionRef.current = rendition;
      rendition.on("relocated", (location: EpubLocation) => {
        if (cancelled) return;
        setAtStart(Boolean(location.atStart));
        setAtEnd(Boolean(location.atEnd));
      });
      await rendition.display();
      if (cancelled) return;
      setReady(true);
    })().catch((cause: unknown) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : "无法打开 EPUB");
    });

    return () => {
      cancelled = true;
      const rendition = renditionRef.current;
      renditionRef.current = null;
      rendition?.destroy();
      book?.destroy();
    };
  }, [documentId, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/nodes?workspaceId=${encodeURIComponent(workspaceId)}&documentId=${encodeURIComponent(documentId)}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("无法读取摘录");
        return (await response.json()) as { nodes: EpubExcerpt[] };
      })
      .then((body) => {
        if (!cancelled) {
          setExcerpts(body.nodes.filter((node) => typeof node.anchor?.cfi === "string"));
        }
      })
      .catch(() => {
        if (!cancelled) setExcerpts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, workspaceId]);

  async function createFromSelection() {
    const selection = readSelection(renditionRef.current);
    if (!selection) {
      setError("请先选中文字。");
      return;
    }

    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        documentId,
        type: "excerpt",
        payload: { text: selection.text },
        anchor: { cfi: selection.cfi },
      }),
    });
    if (!response.ok) {
      setError("摘录失败。");
      return;
    }
    const body = (await response.json()) as { node: EpubExcerpt };
    setExcerpts((current) => [...current, body.node]);
    setError(null);
    selection.range.collapse();
    await showExcerpt(body.node.anchor.cfi);
  }

  async function showExcerpt(cfi: string) {
    const rendition = renditionRef.current;
    if (!rendition) return;
    rendition.annotations.remove(cfi, "highlight");
    await rendition.display(cfi);
    rendition.annotations.highlight(
      cfi,
      { testid: "epub-highlight" },
      undefined,
      "excerpt-highlight",
    );
  }

  return (
    <div data-testid="epub-reader" className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <Link className="underline" href={libraryPath(workspaceId)}>
                返回文库
              </Link>
              <Link data-testid="open-mind-map" className="underline" href={mapPath(workspaceId)}>
                脑图
              </Link>
              <Link data-testid="open-review" className="underline" href={reviewPath(workspaceId)}>
                复习
              </Link>
            </div>
            <h1 className="text-xl font-semibold" data-testid="reader-title">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!ready || atStart}
              onClick={() => void renditionRef.current?.prev()}
            >
              上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!ready || atEnd}
              onClick={() => void renditionRef.current?.next()}
            >
              下一页
            </Button>
            <button
              type="button"
              data-testid="create-excerpt"
              className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void createFromSelection()}
            >
              做成摘录
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          {error ? (
            <p role="alert" data-testid="reader-error" className="mb-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!ready && !error ? <p data-testid="epub-loading">正在打开 EPUB…</p> : null}
          <div
            ref={viewerRef}
            data-testid="epub-viewer"
            className="h-[70vh] min-h-96 w-full overflow-hidden bg-white"
          />
        </div>
        <aside className="space-y-3">
          <h2 className="text-sm font-medium">摘录</h2>
          {excerpts.length === 0 ? (
            <p className="text-sm text-muted-foreground">选中文字后做成摘录。</p>
          ) : (
            <ul className="space-y-2">
              {excerpts.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    data-testid="excerpt-card"
                    className="w-full rounded-xl bg-card px-3 py-2 text-left text-sm ring-1 ring-foreground/10"
                    onClick={() => {
                      void showExcerpt(node.anchor.cfi);
                    }}
                  >
                    {node.payload.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}

function readSelection(rendition: Rendition | null): { text: string; cfi: string; range: Range } | null {
  if (!rendition) return null;
  const contents = rendition.getContents();
  const list = (Array.isArray(contents) ? contents : contents ? [contents] : []) as EpubContents[];
  for (const content of list) {
    const selection = content.window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) continue;
    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (!text) continue;
    const range = selection.getRangeAt(0);
    const cfi = content.cfiFromRange(range);
    if (!cfi.startsWith("epubcfi(") || !cfi.endsWith(")")) continue;
    return { text, cfi, range };
  }
  return null;
}
