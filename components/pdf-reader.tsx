"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ExcerptPopover, type PopoverAnchor } from "@/components/reader/excerpt-popover";
import type { OpenedExcerpt, ReaderEmbedProps } from "@/components/reader/embed";
import { cardExtras, readCardFields } from "@/src/lib/excerpt/card";
import { highlightPresentation, type HighlightMode } from "@/src/lib/excerpt/colors";
import { useNodeColorSync } from "@/src/lib/excerpt/use-node-color";
import { useNarrow } from "@/src/lib/study/use-narrow";
import { pdfFitScale } from "@/src/lib/pdf/fit-scale";
import { normalizeSelectionAnchor, type SelectionAnchor } from "@/src/lib/pdf/selection-anchor";
import { locateFromAnchor } from "@/src/lib/study/link";
import { libraryPath, LOCAL_WORKSPACE_ID, mapPath, reviewPath } from "@/src/lib/workspace";

type ExcerptNode = {
  id: string;
  documentId?: string;
  payload: Record<string, unknown>;
  anchor: {
    page: number;
    rects: Array<{ x: number; y: number; width: number; height: number }>;
  };
};

type SelectionDraft = PopoverAnchor & {
  text: string;
  anchor: SelectionAnchor;
};

function markStyle(mode: "fill" | "underline" | "title", color: string): CSSProperties {
  if (mode === "fill") return { background: color, opacity: 0.45 };
  return {
    borderBottom: mode === "title" ? "2px dashed #2233D9" : `3px solid ${color}`,
  };
}

export function PdfReader(props: ReaderEmbedProps = {}) {
  const params = useSearchParams();
  const documentId = props.documentId ?? params.get("documentId");
  const workspaceId = props.workspaceId ?? params.get("workspaceId") ?? LOCAL_WORKSPACE_ID;
  if (!documentId) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p>缺少文档。</p>
        <Link className="text-sm text-brand" href="/">
          返回文库
        </Link>
      </main>
    );
  }
  return (
    <PdfDocument
      key={`${workspaceId}:${documentId}`}
      documentId={documentId}
      workspaceId={workspaceId}
      embedded={props.embedded}
      locate={props.locate}
      onExcerptOpen={props.onExcerptOpen}
      onExcerptCreated={props.onExcerptCreated}
    />
  );
}

function PdfDocument({
  documentId,
  workspaceId,
  embedded = false,
  locate = null,
  onExcerptOpen,
  onExcerptCreated,
}: {
  documentId: string;
  workspaceId: string;
  embedded?: boolean;
  locate?: ReaderEmbedProps["locate"];
  onExcerptOpen?: (excerpt: OpenedExcerpt) => void;
  onExcerptCreated?: (excerpt: OpenedExcerpt) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [title, setTitle] = useState("PDF");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [excerpts, setExcerpts] = useState<ExcerptNode[]>([]);
  const [activeExcerptId, setActiveExcerptId] = useState<string | null>(null);
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
    if (target?.kind === "pdf") {
      setPageNumber(target.page);
      setActiveExcerptId(locate.nodeId);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void>; promise: Promise<PDFDocumentProxy> } | null = null;

    void (async () => {
      const [fileResponse, listResponse] = await Promise.all([
        fetch(`/api/documents/${encodeURIComponent(documentId)}/file?workspaceId=${encodeURIComponent(workspaceId)}`),
        fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`),
      ]);
      if (!fileResponse.ok) throw new Error("无法打开 PDF");
      if (listResponse.ok) {
        const list = (await listResponse.json()) as { documents: Array<{ id: string; title: string }> };
        const found = list.documents.find((item) => item.id === documentId);
        if (found && !cancelled) setTitle(found.title);
      }
      const data = new Uint8Array(await fileResponse.arrayBuffer());
      if (cancelled) return;
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      task = pdfjs.getDocument({
        data,
        standardFontDataUrl: "/standard_fonts/",
        useSystemFonts: true,
      });
      const loaded = await task.promise;
      if (cancelled) return;
      setPdf(loaded);
      setPageCount(loaded.numPages);
    })().catch((cause: unknown) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : "无法打开 PDF");
    });

    return () => {
      cancelled = true;
      void task?.destroy().catch(() => {});
    };
  }, [documentId, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/nodes?workspaceId=${encodeURIComponent(workspaceId)}&documentId=${encodeURIComponent(documentId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("无法读取摘录");
        return (await response.json()) as { nodes: ExcerptNode[] };
      })
      .then((body) => {
        if (!cancelled) setExcerpts(body.nodes.filter((node) => Array.isArray(node.anchor?.rects)));
      })
      .catch(() => {
        if (!cancelled) setExcerpts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, workspaceId]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setFrameWidth(frame.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [pdf]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;
    const pageElement = pageRef.current;
    if (!pdf || !canvas || !textLayer || !pageElement || frameWidth <= 0) return;

    let cancelled = false;
    const renderTask: { cancel: () => void } = { cancel: () => {} };
    const textTask: { cancel: () => void } = { cancel: () => {} };

    void (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pdfFitScale(base.width, frameWidth) });
      pageElement.style.setProperty("--scale-factor", String(viewport.scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const task = page.render({
        canvas,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      renderTask.cancel = () => task.cancel();
      await task.promise;
      if (cancelled) return;
      textLayer.replaceChildren();
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      const layer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayer,
        viewport,
      });
      textTask.cancel = () => layer.cancel();
      await layer.render();
    })().catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof Error && cause.name === "RenderingCancelledException") return;
      setError(cause instanceof Error ? cause.message : "无法渲染页面");
    });

    return () => {
      cancelled = true;
      renderTask.cancel();
      textTask.cancel();
    };
  }, [pdf, pageNumber, frameWidth]);

  useEffect(() => {
    const onSelection = () => {
      const pageElement = pageRef.current;
      const textLayer = textLayerRef.current;
      const selection = window.getSelection();
      if (!pageElement || !textLayer || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const anchorNode = selection.anchorNode;
      if (!anchorNode || !textLayer.contains(anchorNode)) return;
      const text = selection.toString().trim();
      if (!text) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const anchor = normalizeSelectionAnchor({
        page: pageNumber,
        pageBox: pageElement.getBoundingClientRect(),
        clientRects: [...range.getClientRects()],
      });
      if (anchor.rects.length === 0) return;
      setDraft({ x: rect.left + rect.width / 2, y: rect.bottom, text, anchor });
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, [pageNumber]);

  function openExcerpt(node: ExcerptNode) {
    setPageNumber(node.anchor.page);
    setActiveExcerptId(node.id);
    const fields = readCardFields(node.payload);
    onExcerptOpen?.({
      id: node.id,
      text: fields.text,
      anchor: node.anchor,
      documentId,
    });
  }

  async function createExcerpt(input: {
    text: string;
    anchor: SelectionAnchor;
    asTitle?: boolean;
    comment?: string;
  }) {
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
        anchor: input.anchor,
      }),
    });
    if (!response.ok) {
      setError("摘录失败。");
      return;
    }
    const body = (await response.json()) as { node: ExcerptNode };
    setExcerpts((current) => [...current, body.node]);
    setActiveExcerptId(body.node.id);
    setError(null);
    setDraft(null);
    window.getSelection()?.removeAllRanges();
    const fields = readCardFields(body.node.payload);
    onExcerptCreated?.({ id: body.node.id, text: fields.text, anchor: body.node.anchor, documentId });
  }

  async function createFromSelection() {
    const pageElement = pageRef.current;
    const textLayer = textLayerRef.current;
    const selection = window.getSelection();
    if (!pageElement || !textLayer || !selection || selection.rangeCount === 0) {
      setError("请先选中文字。");
      return;
    }
    const text = selection.toString().trim();
    const anchorNode = selection.anchorNode;
    if (!text || !anchorNode || !textLayer.contains(anchorNode)) {
      setError("请先选中文字。");
      return;
    }
    const anchor = normalizeSelectionAnchor({
      page: pageNumber,
      pageBox: pageElement.getBoundingClientRect(),
      clientRects: [...selection.getRangeAt(0).getClientRects()],
    });
    if (anchor.rects.length === 0) {
      setError("请先选中文字。");
      return;
    }
    await createExcerpt({ text, anchor });
  }

  const pageMarks = excerpts.filter((node) => node.anchor.page === pageNumber);

  return (
    <div
      data-testid="pdf-reader"
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
              disabled={!pdf || pageNumber <= 1}
              onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            >
              上一页
            </button>
            <p className="min-w-16 text-center text-sm">
              <span data-testid="reader-current-page">{pdf ? pageNumber : "…"}</span>
              <span className="text-[#8E8E93]"> / {pageCount || "…"}</span>
            </p>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-[#E6E6E6] bg-white px-3 text-sm"
              disabled={!pdf || pageNumber >= pageCount}
              onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
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
        <div ref={frameRef} className="min-h-0 min-w-0 flex-1 overflow-auto">
          {error ? (
            <p role="alert" data-testid="reader-error" className="mb-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {pdf ? (
            <div
              ref={pageRef}
              data-testid="pdf-page"
              data-page-number={pageNumber}
              className="pdf-page relative mx-auto w-fit max-w-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            >
              <canvas ref={canvasRef} data-testid="pdf-canvas" className="block" />
              {pageMarks.map((node) => {
                const fields = readCardFields(node.payload);
                const presentation = highlightPresentation({
                  color: fields.color,
                  highlight: fields.highlight,
                  asTitle: fields.asTitle,
                });
                const active = node.id === activeExcerptId;
                return (
                  <div
                    key={node.id}
                    data-testid={active ? "excerpt-highlight" : undefined}
                    data-highlight={presentation.mode}
                    data-color={String(fields.color ?? 1)}
                    className="pointer-events-none absolute inset-0 z-[1]"
                  >
                    {node.anchor.rects.map((rect, index) => (
                      <div
                        key={`${rect.x}-${rect.y}-${index}`}
                        className="absolute"
                        style={{
                          left: `${rect.x * 100}%`,
                          top: `${rect.y * 100}%`,
                          width: `${rect.width * 100}%`,
                          height: `${rect.height * 100}%`,
                          ...markStyle(presentation.mode, presentation.color),
                        }}
                      />
                    ))}
                  </div>
                );
              })}
              <div ref={textLayerRef} data-testid="pdf-text-layer" className="textLayer" />
            </div>
          ) : (
            <p data-testid="pdf-loading">正在打开 PDF…</p>
          )}
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
                      {fields.comment ? <span className="block px-3 pb-2 text-xs text-[#8E8E93]">{fields.comment}</span> : null}
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
          void createExcerpt({ text: draft.text, anchor: draft.anchor });
        }}
        onTitle={() => {
          if (!draft) return;
          void createExcerpt({ text: draft.text, anchor: draft.anchor, asTitle: true });
        }}
        onComment={(comment) => {
          if (!draft) return;
          void createExcerpt({ text: draft.text, anchor: draft.anchor, comment });
        }}
      />
    </div>
  );
}
