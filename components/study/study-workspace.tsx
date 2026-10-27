"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentReader } from "@/components/document-reader";
import { LogoutButton } from "@/components/logout-button";
import type { OpenedExcerpt } from "@/components/reader/embed";
import {
  focusesDocument,
  focusesMap,
  linkModeLabel,
  type LinkMode,
  type LocateRequest,
} from "@/src/lib/study/link";
import {
  clampSplitRatio,
  paneHidden,
  ratioFromPointer,
  SPLIT_DEFAULT,
  type CollapsedPane,
} from "@/src/lib/study/split";
import { libraryPath, mapPath, reviewPath } from "@/src/lib/workspace";

const MindMapCanvas = dynamic(() => import("@/components/mind-map-canvas"), {
  ssr: false,
  loading: () => <p className="px-4 py-6 text-sm text-[#8E8E93]">正在打开脑图…</p>,
});

const linkOptions: Array<{ id: LinkMode; testId: string }> = [
  { id: "both", testId: "link-both" },
  { id: "doc-to-map", testId: "link-doc-to-map" },
  { id: "map-to-doc", testId: "link-map-to-doc" },
  { id: "off", testId: "link-off" },
];

const splitListeners = new Set<() => void>();
const NARROW_QUERY = "(max-width: 767px)";

function readSplit(workspaceId: string): number {
  const stored = window.localStorage.getItem(`read-split:${workspaceId}`);
  if (!stored) return SPLIT_DEFAULT;
  return clampSplitRatio(Number(stored));
}

function writeSplit(workspaceId: string, ratio: number) {
  window.localStorage.setItem(`read-split:${workspaceId}`, String(clampSplitRatio(ratio)));
  for (const listener of splitListeners) listener();
}

function useSplitRatio(workspaceId: string): [number, (ratio: number) => void] {
  const ratio = useSyncExternalStore(
    (callback) => {
      splitListeners.add(callback);
      return () => splitListeners.delete(callback);
    },
    () => readSplit(workspaceId),
    () => SPLIT_DEFAULT,
  );
  return [ratio, (next) => writeSplit(workspaceId, next)];
}

function useNarrow(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia(NARROW_QUERY);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

export function StudyWorkspace({ workspaceId }: { workspaceId: string }) {
  const params = useSearchParams();
  const frameRef = useRef<HTMLDivElement>(null);
  const focusSeq = useRef(0);
  const locateSeq = useRef(0);
  const [documentId, setDocumentId] = useState(params.get("doc") ?? params.get("documentId") ?? "");
  const [ratio, setRatio] = useSplitRatio(workspaceId);
  const [collapsed, setCollapsed] = useState<CollapsedPane>(null);
  const narrow = useNarrow();
  const [linkMode, setLinkMode] = useState<LinkMode>("both");
  const [linkOpen, setLinkOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [focus, setFocus] = useState<{ id: string; token: number } | null>(null);
  const [locate, setLocate] = useState<LocateRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then(async (response) => {
        if (!response.ok) return [] as Array<{ id: string }>;
        const body = (await response.json()) as { documents: Array<{ id: string }> };
        return body.documents;
      })
      .then((list) => {
        if (cancelled) return;
        setDocumentId((current) => current || list[0]?.id || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function onHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = frameRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const layout = narrow ? "stack" : "split";
    const move = (ev: PointerEvent) => {
      setRatio(
        ratioFromPointer({
          layout,
          client: layout === "stack" ? ev.clientY : ev.clientX,
          origin: layout === "stack" ? bounds.top : bounds.left,
          span: layout === "stack" ? bounds.height : bounds.width,
        }),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    event.preventDefault();
  }

  function onNodeActivate(node: { id: string; documentId?: string; anchor?: unknown }) {
    if (!focusesDocument(linkMode) || !node.anchor) return;
    if (node.documentId && node.documentId !== documentId) setDocumentId(node.documentId);
    locateSeq.current += 1;
    setLocate({ token: locateSeq.current, nodeId: node.id, anchor: node.anchor });
  }

  function focusNode(id: string) {
    focusSeq.current += 1;
    setFocus({ id, token: focusSeq.current });
  }

  function onExcerptOpen(excerpt: OpenedExcerpt) {
    if (!focusesMap(linkMode)) return;
    focusNode(excerpt.id);
  }

  function onExcerptCreated(excerpt: OpenedExcerpt) {
    setRevision((current) => current + 1);
    if (focusesMap(linkMode)) focusNode(excerpt.id);
  }

  const layout = narrow ? "stack" : "split";

  return (
    <div
      data-testid="study-workspace"
      data-layout={layout}
      data-split-ratio={Math.round(ratio)}
      data-collapsed={collapsed ?? "none"}
      data-link-mode={linkMode}
      className="relative h-dvh overflow-hidden bg-canvas text-[#1C1C1E]"
    >
      <header className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-white/95 px-2 py-1 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur">
          <Link href={libraryPath(workspaceId)} className="shrink-0 rounded-full px-3 py-2 text-[#67707D]">
            文库
          </Link>
          <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1.5 font-medium text-[#2F6FEB]">文档</span>
          <span className="shrink-0 px-1 text-[#C5C5C7]">|</span>
          <Link data-testid="open-mind-map" href={mapPath(workspaceId)} className="shrink-0 rounded-full px-3 py-2 text-[#67707D]">
            脑图
          </Link>
          <Link data-testid="open-review" href={reviewPath(workspaceId)} className="shrink-0 rounded-full px-3 py-2 text-[#67707D]">
            复习
          </Link>
          <LogoutButton />
        </div>
      </header>
      <div ref={frameRef} className={`flex h-full min-h-0 pt-16 ${narrow ? "flex-col" : "flex-row"}`}>
        <section
          data-testid="mind-pane"
          hidden={paneHidden(collapsed, "map")}
          className="flex min-h-0 min-w-0 flex-col"
          style={
            paneHidden(collapsed, "map")
              ? undefined
              : collapsed === "doc"
                ? { flex: "1 1 auto" }
                : { flex: `0 0 ${ratio}%` }
          }
        >
          <MindMapCanvas
            workspaceId={workspaceId}
            fill
            focusNodeId={focus?.id ?? null}
            focusToken={focus?.token ?? 0}
            revision={revision}
            onNodeActivate={onNodeActivate}
          />
        </section>
        <div className={`relative z-20 flex shrink-0 items-center justify-center ${narrow ? "h-12 w-full" : "w-8"}`}>
          <div className={`flex items-center gap-1 ${narrow ? "flex-row" : "flex-col"}`}>
            <button
              type="button"
              data-testid="collapse-map"
              aria-label="收起脑图"
              className="grid size-8 place-items-center rounded-full bg-white text-sm text-[#67707D] shadow"
              onClick={() => setCollapsed((current) => (current === "map" ? null : "map"))}
            >
              {narrow ? "⌃" : "‹"}
            </button>
            <div
              data-testid="split-handle"
              className={`grid cursor-col-resize place-items-center rounded-full bg-white text-[#67707D] shadow ${narrow ? "h-8 w-10 cursor-row-resize" : "h-10 w-8"}`}
              onPointerDown={onHandlePointerDown}
            >
              ⋮
            </div>
            <div className="relative">
              <button
                type="button"
                data-testid="link-mode"
                data-mode={linkMode}
                aria-label={`联动 ${linkModeLabel(linkMode)}`}
                className="grid size-8 place-items-center rounded-full bg-[#4894F3] text-xs text-white shadow"
                onClick={() => setLinkOpen((current) => !current)}
              >
                ⇄
              </button>
              {linkOpen ? (
                <div
                  data-testid="link-mode-menu"
                  className="absolute top-10 left-1/2 z-30 w-36 -translate-x-1/2 rounded-xl bg-white p-1 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
                >
                  {linkOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      data-testid={option.testId}
                      className={`block w-full rounded-lg px-2 py-1.5 text-left ${linkMode === option.id ? "bg-surface-sel text-[#2F6FEB]" : ""}`}
                      onClick={() => {
                        setLinkMode(option.id);
                        setLinkOpen(false);
                      }}
                    >
                      {linkModeLabel(option.id)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              data-testid="collapse-doc"
              aria-label="收起文档"
              className="grid size-8 place-items-center rounded-full bg-white text-sm text-[#67707D] shadow"
              onClick={() => setCollapsed((current) => (current === "doc" ? null : "doc"))}
            >
              {narrow ? "⌄" : "›"}
            </button>
          </div>
        </div>
        <section
          data-testid="doc-pane"
          hidden={paneHidden(collapsed, "doc")}
          className="flex min-h-0 min-w-0 flex-col bg-white"
          style={paneHidden(collapsed, "doc") ? undefined : { flex: "1 1 auto" }}
        >
          {documentId ? (
            <DocumentReader
              key={documentId}
              documentId={documentId}
              workspaceId={workspaceId}
              embedded
              locate={locate}
              onExcerptOpen={onExcerptOpen}
              onExcerptCreated={onExcerptCreated}
            />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-[#8E8E93]">
              从文库打开一篇 PDF 或 EPUB，摘录会和脑图卡片连在一起。
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
