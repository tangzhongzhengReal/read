"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { normalizeSelectionAnchor } from "@/src/lib/pdf/selection-anchor";
import { libraryPath, LOCAL_WORKSPACE_ID, mapPath, reviewPath } from "@/src/lib/workspace";

type ExcerptNode = {
  id: string;
  payload: { text: string };
  anchor: {
    page: number;
    rects: Array<{ x: number; y: number; width: number; height: number }>;
  };
};

const PDF_TO_CSS_UNITS = 96 / 72;
const USER_SCALE = 1;

export function PdfReader() {
  const params = useSearchParams();
  const documentId = params.get("documentId");
  const workspaceId = params.get("workspaceId") ?? LOCAL_WORKSPACE_ID;
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
  return (
    <PdfDocument key={`${workspaceId}:${documentId}`} documentId={documentId} workspaceId={workspaceId} />
  );
}

function PdfDocument({
  documentId,
  workspaceId,
}: {
  documentId: string;
  workspaceId: string;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [title, setTitle] = useState("PDF");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [excerpts, setExcerpts] = useState<ExcerptNode[]>([]);
  const [activeExcerptId, setActiveExcerptId] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void>; promise: Promise<PDFDocumentProxy> } | null = null;

    void (async () => {
      const [fileResponse, listResponse] = await Promise.all([
        fetch(
          `/api/documents/${encodeURIComponent(documentId)}/file?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
        fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`),
      ]);
      if (!fileResponse.ok) throw new Error("无法打开 PDF");
      if (listResponse.ok) {
        const list = (await listResponse.json()) as {
          documents: Array<{ id: string; title: string }>;
        };
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
    fetch(
      `/api/nodes?workspaceId=${encodeURIComponent(workspaceId)}&documentId=${encodeURIComponent(documentId)}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("无法读取摘录");
        return (await response.json()) as { nodes: ExcerptNode[] };
      })
      .then((body) => {
        if (!cancelled) setExcerpts(body.nodes);
      })
      .catch(() => {
        if (!cancelled) setExcerpts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, workspaceId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;
    const pageElement = pageRef.current;
    if (!pdf || !canvas || !textLayer || !pageElement) return;

    let cancelled = false;
    const renderTask: { cancel: () => void } = { cancel: () => {} };
    const textTask: { cancel: () => void } = { cancel: () => {} };

    void (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: USER_SCALE * PDF_TO_CSS_UNITS });
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
  }, [pdf, pageNumber]);

  const activeExcerpt = excerpts.find((node) => node.id === activeExcerptId);
  const highlight =
    activeExcerpt && activeExcerpt.anchor.page === pageNumber ? activeExcerpt.anchor.rects : [];

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

    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        documentId,
        type: "excerpt",
        payload: { text },
        anchor,
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
    selection.removeAllRanges();
  }

  return (
    <div data-testid="pdf-reader" className="min-h-svh bg-background text-foreground">
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
              disabled={!pdf || pageNumber <= 1}
              onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            >
              上一页
            </Button>
            <p className="min-w-16 text-center text-sm">
              <span data-testid="reader-current-page">{pdf ? pageNumber : "…"}</span>
              <span className="text-muted-foreground"> / {pageCount || "…"}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={!pdf || pageNumber >= pageCount}
              onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
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
          {pdf ? (
            <div
              ref={pageRef}
              data-testid="pdf-page"
              data-page-number={pageNumber}
              className="pdf-page relative mx-auto w-fit bg-white shadow-sm"
            >
              <canvas ref={canvasRef} data-testid="pdf-canvas" className="block" />
              {highlight.length > 0 ? (
                <div data-testid="excerpt-highlight" className="pointer-events-none absolute inset-0 z-[1]">
                  {highlight.map((rect, index) => (
                    <div
                      key={`${rect.x}-${rect.y}-${index}`}
                      className="absolute bg-yellow-300/50"
                      style={{
                        left: `${rect.x * 100}%`,
                        top: `${rect.y * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                      }}
                    />
                  ))}
                </div>
              ) : null}
              <div ref={textLayerRef} data-testid="pdf-text-layer" className="textLayer" />
            </div>
          ) : (
            <p data-testid="pdf-loading">正在打开 PDF…</p>
          )}
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
                      setPageNumber(node.anchor.page);
                      setActiveExcerptId(node.id);
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
