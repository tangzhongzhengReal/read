"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Book, Rendition } from "epubjs";
import { LogoutButton } from "@/components/logout-button";
import { ExcerptPopover, type PopoverAnchor } from "@/components/reader/excerpt-popover";
import type { ReaderEmbedProps } from "@/components/reader/embed";
import { cardExtras, readCardFields } from "@/src/lib/excerpt/card";
import { highlightPresentation, type HighlightMode } from "@/src/lib/excerpt/colors";
import { useNodeColorSync } from "@/src/lib/excerpt/use-node-color";
import { useNarrow } from "@/src/lib/study/use-narrow";
import {
  displayEpubSection,
  epubFileUrl,
  epubStageLabel,
  openEpubBook,
  type EpubOpenStage,
} from "@/src/lib/epub/load-epub";
import { prefetchEpubRuntime } from "@/src/lib/epub/runtime";
import { locateFromAnchor } from "@/src/lib/study/link";
import { libraryPath, mapPath, reviewPath } from "@/src/lib/workspace";

if (typeof window !== "undefined") {
  void prefetchEpubRuntime();
}

type EpubExcerpt = {
  id: string;
  payload: Record<string, unknown>;
  anchor: { cfi: string };
};

type EpubContents = {
  window: Window;
  cfiFromRange: (range: Range) => string;
  document?: Document;
};

type EpubLocation = {
  atStart?: boolean;
  atEnd?: boolean;
  start?: { href?: string };
};

type SelectionDraft = PopoverAnchor & {
  text: string;
  cfi: string;
};

type AnnotationHost = {
  remove: (cfi: string, type: string) => void;
  highlight: (cfi: string, data: object, cb: undefined, className: string, styles: object) => void;
  underline: (cfi: string, data: object, cb: undefined, className: string, styles: object) => void;
};

export function EpubReader({
  documentId,
  workspaceId,
  embedded = false,
  locate = null,
  onExcerptOpen,
  onExcerptCreated,
}: ReaderEmbedProps & { documentId: string; workspaceId: string }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const excerptsRef = useRef<EpubExcerpt[]>([]);
  const activeRef = useRef<string | null>(null);
  const [title, setTitle] = useState("EPUB");
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<EpubOpenStage>("preparing");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excerpts, setExcerpts] = useState<EpubExcerpt[]>([]);
  const [activeExcerptId, setActiveExcerptId] = useState<string | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [color, setColor] = useState(1);
  const [highlight, setHighlight] = useState<HighlightMode>("fill");
  const [draft, setDraft] = useState<SelectionDraft | null>(null);
  const [appliedLocate, setAppliedLocate] = useState(0);
  const narrow = useNarrow();
  useNodeColorSync(setExcerpts);
  const dismissPopover = useCallback(() => setDraft(null), []);
  if (locate && locate.token !== appliedLocate) {
    const target = locateFromAnchor(locate.anchor);
    setAppliedLocate(locate.token);
    if (target?.kind === "epub") {
      activeRef.current = locate.nodeId;
      setActiveExcerptId(locate.nodeId);
    }
  }

  useEffect(() => {
    excerptsRef.current = excerpts;
  }, [excerpts]);

  useEffect(() => {
    activeRef.current = activeExcerptId;
  }, [activeExcerptId]);

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
          paintEpubExcerpts(rendition, excerptsRef.current, activeRef.current);
        });
        rendition.on("selected", (cfiRange: string, contents: EpubContents) => {
          if (cancelled) return;
          const selection = contents.window.getSelection();
          const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
          if (!text) return;
          const cfi = cfiRange.startsWith("epubcfi(")
            ? cfiRange
            : selection && selection.rangeCount > 0
              ? contents.cfiFromRange(selection.getRangeAt(0))
              : "";
          if (!cfi.startsWith("epubcfi(") || !cfi.endsWith(")")) return;
          const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
          const rect = range?.getBoundingClientRect();
          const iframe = viewer.querySelector("iframe");
          const iframeBox = iframe?.getBoundingClientRect();
          if (!rect || !iframeBox) return;
          setDraft({
            x: iframeBox.left + rect.left + rect.width / 2,
            y: iframeBox.top + rect.bottom,
            text,
            cfi,
          });
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
    fetch(`/api/nodes?workspaceId=${encodeURIComponent(workspaceId)}&documentId=${encodeURIComponent(documentId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("无法读取摘录");
        return (await response.json()) as { nodes: EpubExcerpt[] };
      })
      .then((body) => {
        if (!cancelled) setExcerpts(body.nodes.filter((node) => typeof node.anchor?.cfi === "string"));
      })
      .catch(() => {
        if (!cancelled) setExcerpts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, workspaceId]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !ready) return;
    paintEpubExcerpts(rendition, excerpts, activeExcerptId);
  }, [excerpts, ready, activeExcerptId]);

  useEffect(() => {
    if (!locate || !ready) return;
    const target = locateFromAnchor(locate.anchor);
    if (!target || target.kind !== "epub") return;
    void showExcerpt(target.cfi);
  }, [locate, ready]);

  async function createExcerpt(input: { text: string; cfi: string; asTitle?: boolean; comment?: string }) {
    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        documentId,
        type: "excerpt",
        payload: {
          text: input.text,
          ...cardExtras({
            text: input.text,
            title: input.asTitle ? input.text.slice(0, 250) : undefined,
            comment: input.comment,
            color,
            highlight: input.asTitle ? "underline" : highlight,
            asTitle: input.asTitle,
          }),
        },
        anchor: { cfi: input.cfi },
      }),
    });
    if (!response.ok) {
      setError("摘录失败。");
      return;
    }
    const body = (await response.json()) as { node: EpubExcerpt };
    setExcerpts((current) => [...current, body.node]);
    setActiveExcerptId(body.node.id);
    setError(null);
    setDraft(null);
    const fields = readCardFields(body.node.payload);
    onExcerptCreated?.({ id: body.node.id, text: fields.text, anchor: body.node.anchor, documentId });
    await showExcerpt(body.node.anchor.cfi);
  }

  async function createFromSelection() {
    const selection = readSelection(renditionRef.current);
    if (!selection) {
      setError("请先选中文字。");
      return;
    }
    selection.range.collapse();
    await createExcerpt({ text: selection.text, cfi: selection.cfi });
  }

  async function showExcerpt(cfi: string) {
    const rendition = renditionRef.current;
    if (!rendition) return;
    try {
      await displayEpubSection(rendition, cfi);
      paintEpubExcerpts(rendition, excerptsRef.current, activeRef.current);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "无法打开 EPUB");
    }
  }

  function openExcerpt(node: EpubExcerpt) {
    activeRef.current = node.id;
    setActiveExcerptId(node.id);
    const fields = readCardFields(node.payload);
    onExcerptOpen?.({ id: node.id, text: fields.text, anchor: node.anchor, documentId });
    void showExcerpt(node.anchor.cfi);
  }

  return (
    <div
      data-testid="epub-reader"
      className={
        embedded
          ? "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white text-[#1C1C1E]"
          : "flex min-h-svh flex-col overflow-x-clip bg-white text-[#1C1C1E]"
      }
    >
      <header className={embedded ? "shrink-0 border-b border-[#EFEFEF] bg-white" : "px-4 pt-4"}>
        <div className={embedded ? "flex flex-col gap-2 px-3 py-2" : "mx-auto flex max-w-7xl flex-col gap-3 rounded-full bg-white px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"}>
          {embedded ? null : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <Link className="inline-flex min-h-11 items-center text-[#67707D]" href={libraryPath(workspaceId)}>
                  文库
                </Link>
                <Link data-testid="open-mind-map" className="inline-flex min-h-11 items-center text-[#67707D]" href={mapPath(workspaceId)}>
                  脑图
                </Link>
                <Link data-testid="open-review" className="inline-flex min-h-11 items-center text-[#67707D]" href={reviewPath(workspaceId)}>
                  复习
                </Link>
              </div>
              <LogoutButton />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="truncate text-base font-semibold" data-testid="reader-title">
              {title}
            </h1>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-[#E6E6E6] bg-white px-3 text-sm"
              disabled={!ready || atStart}
              onClick={() => void renditionRef.current?.prev()}
            >
              上一页
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-[#E6E6E6] bg-white px-3 text-sm"
              disabled={!ready || atEnd}
              onClick={() => void renditionRef.current?.next()}
            >
              下一页
            </button>
            {narrow ? null : (
              <button
                type="button"
                data-testid="create-excerpt"
                className="inline-flex min-h-11 items-center rounded-lg bg-[#4894F3] px-3 text-sm font-medium text-white"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void createFromSelection()}
              >
                做成摘录
              </button>
            )}
            </div>
          </div>
        </div>
      </header>
      <main className={embedded ? "flex min-h-0 min-w-0 flex-1 flex-col" : "mx-auto grid min-w-0 max-w-7xl gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_16rem]"}>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {error ? (
            <p role="alert" data-testid="reader-error" className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-white/90 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!ready && !error ? (
            <p data-testid="epub-loading" data-stage={stage} className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-white/90 px-3 py-2 text-sm text-[#8E8E93]">
              {epubStageLabel(stage, progress)}
            </p>
          ) : null}
          <div
            ref={viewerRef}
            data-testid="epub-viewer"
            className={embedded ? "min-h-0 w-full max-w-full flex-1 overflow-hidden bg-white" : "h-[min(70dvh,40rem)] min-h-64 w-full max-w-full overflow-hidden bg-white"}
          />
        </div>
        <aside className={embedded ? "max-h-36 min-h-0 w-full min-w-0 shrink-0 overflow-x-hidden overflow-y-auto border-t border-[#EFEFEF] bg-white" : "min-w-0 space-y-3"}>
          {embedded ? null : <h2 className="text-sm font-medium">摘录</h2>}
          {excerpts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[#8E8E93]">选中文字后做成摘录。</p>
          ) : (
            <ul className={embedded ? "flex flex-col gap-2 p-2" : "space-y-2"}>
              {excerpts.map((node) => {
                const fields = readCardFields(node.payload);
                const presentation = highlightPresentation({
                  color: fields.color,
                  highlight: fields.highlight,
                  asTitle: fields.asTitle,
                });
                return (
                  <li key={node.id} className="min-w-0">
                    <button
                      type="button"
                      data-testid="excerpt-card"
                      className="min-h-11 w-full overflow-hidden rounded-lg bg-white text-left text-sm shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
                      onClick={() => openExcerpt(node)}
                    >
                      <span className="block px-3 py-1 text-xs font-medium" style={{ background: presentation.color }}>
                        {fields.title ?? "摘录"}
                      </span>
                      <span className="block px-3 py-2 break-words">{fields.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </main>
      {narrow ? (
        <div className="shrink-0 px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            data-testid="create-excerpt"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#4894F3] px-3 text-sm font-medium text-white"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void createFromSelection()}
          >
            做成摘录
          </button>
        </div>
      ) : null}
      <ExcerptPopover
        anchor={draft}
        color={color}
        highlight={highlight}
        onColor={setColor}
        onHighlight={setHighlight}
        onDismiss={dismissPopover}
        onExcerpt={() => {
          if (!draft) return;
          void createExcerpt({ text: draft.text, cfi: draft.cfi });
        }}
        onTitle={() => {
          if (!draft) return;
          void createExcerpt({ text: draft.text, cfi: draft.cfi, asTitle: true });
        }}
        onComment={(comment) => {
          if (!draft) return;
          void createExcerpt({ text: draft.text, cfi: draft.cfi, comment });
        }}
      />
    </div>
  );
}

function paintEpubExcerpts(rendition: Rendition, excerpts: EpubExcerpt[], activeId: string | null) {
  const annotations = rendition.annotations as unknown as AnnotationHost;
  for (const node of excerpts) {
    const cfi = node.anchor.cfi;
    try {
      annotations.remove(cfi, "highlight");
    } catch {
      /* The mark may not be attached to the current chapter. */
    }
    try {
      annotations.remove(cfi, "underline");
    } catch {
      /* Same as highlight removal. */
    }
    const fields = readCardFields(node.payload);
    const presentation = highlightPresentation({
      color: fields.color,
      highlight: fields.highlight,
      asTitle: fields.asTitle,
    });
    const data = node.id === activeId ? { testid: "epub-highlight" } : { mark: node.id };
    try {
      if (presentation.mode === "fill") {
        annotations.highlight(cfi, data, undefined, "excerpt-highlight", {
          fill: presentation.color,
          "fill-opacity": "0.45",
          "mix-blend-mode": "multiply",
        });
      } else {
        annotations.underline(cfi, data, undefined, "excerpt-underline", {
          stroke: presentation.color,
          "stroke-opacity": "0.95",
          "stroke-width": presentation.mode === "title" ? "2" : "3",
        });
      }
    } catch {
      /* Off-screen chapters cannot be marked until they are displayed. */
    }
  }
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
