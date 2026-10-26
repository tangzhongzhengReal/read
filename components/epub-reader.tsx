"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Book, Rendition } from "epubjs";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import {
  displayEpubSection,
  epubFileUrl,
  epubStageLabel,
  openEpubBook,
  type EpubOpenStage,
} from "@/src/lib/epub/load-epub";
import { prefetchEpubRuntime } from "@/src/lib/epub/runtime";
import { libraryPath, mapPath, reviewPath } from "@/src/lib/workspace";

if (typeof window !== "undefined") {
  void prefetchEpubRuntime();
}

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
  const [stage, setStage] = useState<EpubOpenStage>("preparing");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excerpts, setExcerpts] = useState<EpubExcerpt[]>([]);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const resources: { book: Book | null; href: string | null; rendition: Rendition | null } = {
      book: null,
      href: null,
      rendition: null,
    };
    const viewer = viewerRef.current;
    if (!viewer) return;

    void (async () => {
      try {
        const opened = await openEpubBook({
          url: epubFileUrl(documentId, workspaceId),
          signal: controller.signal,
          onStage: (next, ratio) => {
            if (cancelled) return;
            setStage(next);
            setProgress(ratio);
          },
        });
        resources.book = opened.book;
        resources.href = opened.href;
        if (cancelled) {
          opened.book.destroy();
          URL.revokeObjectURL(opened.href);
          return;
        }
        setStage("parsing");
        await opened.book.ready;
        if (cancelled) return;
        const width = viewer.clientWidth || 360;
        const height = viewer.clientHeight || 480;
        const rendition = opened.book.renderTo(viewer, {
          width,
          height,
          flow: "scrolled-doc",
          spread: "none",
          manager: "default",
        });
        resources.rendition = rendition;
        renditionRef.current = rendition;
        rendition.on("relocated", (location: EpubLocation) => {
          if (cancelled) return;
          setAtStart(Boolean(location.atStart));
          setAtEnd(Boolean(location.atEnd));
        });
        setStage("rendering");
        setProgress(null);
        await displayEpubSection(rendition, undefined, undefined, controller.signal);
        if (cancelled) return;
        setReady(true);
      } catch (cause: unknown) {
        if (cancelled || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "无法打开 EPUB");
      }
    })();

    void fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { documents: Array<{ id: string; title: string }> };
      })
      .then((list) => {
        if (cancelled || !list) return;
        const found = list.documents.find((item) => item.id === documentId);
        if (found) setTitle(found.title);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      controller.abort();
      const rendition = renditionRef.current ?? resources.rendition;
      renditionRef.current = null;
      rendition?.destroy();
      resources.book?.destroy();
      if (resources.href) URL.revokeObjectURL(resources.href);
    };
  }, [documentId, workspaceId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const rendition = renditionRef.current;
      if (!rendition) return;
      const width = viewer.clientWidth;
      const height = viewer.clientHeight;
      if (width > 0 && height > 0) rendition.resize(width, height);
    });
    observer.observe(viewer);
    return () => observer.disconnect();
  }, [ready]);

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
    try {
      rendition.annotations.remove(cfi, "highlight");
      await displayEpubSection(rendition, cfi);
      rendition.annotations.highlight(cfi, { testid: "epub-highlight" }, undefined, "excerpt-highlight");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "无法打开 EPUB");
    }
  }

  return (
    <div data-testid="epub-reader" className="min-h-svh overflow-x-clip bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <Link className="inline-flex min-h-11 items-center underline" href={libraryPath(workspaceId)}>
                  返回文库
                </Link>
                <Link
                  data-testid="open-mind-map"
                  className="inline-flex min-h-11 items-center underline"
                  href={mapPath(workspaceId)}
                >
                  脑图
                </Link>
                <Link
                  data-testid="open-review"
                  className="inline-flex min-h-11 items-center underline"
                  href={reviewPath(workspaceId)}
                >
                  复习
                </Link>
              </div>
              <h1 className="text-xl font-semibold break-words" data-testid="reader-title">
                {title}
              </h1>
            </div>
            <LogoutButton />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 px-3"
              disabled={!ready || atStart}
              onClick={() => void renditionRef.current?.prev()}
            >
              上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 px-3"
              disabled={!ready || atEnd}
              onClick={() => void renditionRef.current?.next()}
            >
              下一页
            </Button>
            <button
              type="button"
              data-testid="create-excerpt"
              className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void createFromSelection()}
            >
              做成摘录
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          {error ? (
            <p role="alert" data-testid="reader-error" className="mb-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!ready && !error ? (
            <p data-testid="epub-loading" data-stage={stage} className="mb-3 text-sm text-muted-foreground">
              {epubStageLabel(stage, progress)}
            </p>
          ) : null}
          <div
            ref={viewerRef}
            data-testid="epub-viewer"
            className="h-[min(70dvh,40rem)] min-h-64 w-full max-w-full overflow-hidden bg-white"
          />
        </div>
        <aside className="min-w-0 space-y-3">
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
                    className="min-h-11 w-full rounded-xl bg-card px-3 py-2 text-left text-sm break-words ring-1 ring-foreground/10"
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
