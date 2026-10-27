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
  paneToggleLabel,
  ratioFromPointer,
  SPLIT_DEFAULT,
  togglePane,
  type CollapsedPane,
} from "@/src/lib/study/split";
import { LOCAL_WORKSPACE_ID, libraryPath, mapPath, reviewPath } from "@/src/lib/workspace";

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

export function StudyWorkspace() {
  const params = useSearchParams();
  const workspaceId = params.get("workspaceId") || LOCAL_WORKSPACE_ID;
  const frameRef = useRef<HTMLDivElement>(null);
  const focusSeq = useRef(0);
  const locateSeq = useRef(0);
  const [documentId, setDocumentId] = useState(params.get("doc") ?? params.get("documentId") ?? "");
  const [ratio, setRatio] = useSplitRatio(workspaceId);
  const [collapsed, setCollapsed] = useState<CollapsedPane>(null);
  const [mobilePane, setMobilePane] = useState<"map" | "doc">("doc");
  const narrow = useNarrow();
  const [linkMode, setLinkMode] = useState<LinkMode>("both");
  const [linkOpen, setLinkOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [focus, setFocus] = useState<{ id: string; token: number } | null>(null);
  const [locate, setLocate] = useState<LocateRequest | null>(null);

  useEffect(() => {
    if (!linkOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setLinkOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linkOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [collapsed, narrow, mobilePane]);

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
  const showMap = narrow ? mobilePane === "map" : !paneHidden(collapsed, "map");
  const showDoc = narrow ? mobilePane === "doc" : !paneHidden(collapsed, "doc");
  const mapLabel = paneToggleLabel(collapsed, "map");
  const docLabel = paneToggleLabel(collapsed, "doc");

  return (
    <div
      data-testid="study-workspace"
      data-layout={layout}
      data-split-ratio={Math.round(ratio)}
      data-collapsed={collapsed ?? "none"}
      data-link-mode={linkMode}
      className="relative h-dvh overflow-hidden bg-canvas text-[#1C1C1E]"
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full bg-white/95 px-2 py-1 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur">
          <Link href={libraryPath(workspaceId)} className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[#67707D]">
            文库
          </Link>
          <span className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-brand-soft px-3 font-medium text-[#2F6FEB]">文档</span>
          <span className="shrink-0 px-1 text-[#C5C5C7]">|</span>
          <Link data-testid="open-mind-map" href={mapPath(workspaceId)} className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[#67707D]">
            脑图
          </Link>
          <Link data-testid="open-review" href={reviewPath(workspaceId)} className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[#67707D]">
            复习
          </Link>
          <LogoutButton />
        </div>
      </header>
      <div ref={frameRef} className={`flex h-full min-h-0 pt-16 ${narrow ? "flex-col pb-16" : "flex-row"}`}>
        <section
          data-testid="mind-pane"
          hidden={!showMap}
          className={showMap ? "flex min-h-0 min-w-0 flex-col overflow-hidden" : "hidden"}
          style={
            !showMap
              ? undefined
              : narrow || collapsed === "doc"
                ? { flex: "1 1 0%", minWidth: 0, minHeight: 0 }
                : { flex: `0 0 ${ratio}%`, minWidth: 0, maxWidth: "calc(100% - 3.5rem)" }
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
        <div className={`relative z-40 flex shrink-0 items-center justify-center ${narrow ? "hidden" : "w-14"}`}>
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              data-testid="collapse-map"
              aria-label={mapLabel}
              aria-expanded={showMap}
              title={mapLabel}
              className="grid size-11 place-items-center rounded-full bg-white text-sm text-[#67707D] shadow"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setCollapsed((current) => togglePane(current, "map"))}
            >
              {collapsed === "map" ? "展" : "‹"}
            </button>
            <div
              data-testid="split-handle"
              title="拖动调整分栏"
              className="grid h-11 w-11 cursor-col-resize place-items-center rounded-full bg-white text-[#67707D] shadow"
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
                aria-expanded={linkOpen}
                aria-haspopup="menu"
                title={`联动 ${linkModeLabel(linkMode)}`}
                className="grid size-11 place-items-center rounded-full bg-[#4894F3] text-xs text-white shadow"
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
                      className={`block min-h-11 w-full rounded-lg px-2 py-2 text-left ${linkMode === option.id ? "bg-surface-sel text-[#2F6FEB]" : ""}`}
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
              aria-label={docLabel}
              aria-expanded={showDoc}
              title={docLabel}
              className="grid size-11 place-items-center rounded-full bg-white text-sm text-[#67707D] shadow"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setCollapsed((current) => togglePane(current, "doc"))}
            >
              {collapsed === "doc" ? "展" : "›"}
            </button>
          </div>
        </div>
        <section
          data-testid="doc-pane"
          hidden={!showDoc}
          className={showDoc ? "flex min-h-0 min-w-0 flex-col overflow-hidden bg-white" : "hidden"}
          style={!showDoc ? undefined : { flex: "1 1 0%", minWidth: 0, minHeight: 0 }}
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
            <div className="grid h-full min-h-48 place-items-center bg-white px-6 text-center">
              <p className="max-w-sm rounded-2xl bg-canvas px-6 py-8 text-sm text-[#67707D]">
                从文库打开一篇 PDF 或 EPUB，摘录会和脑图卡片连在一起。
              </p>
            </div>
          )}
        </section>
      </div>
      {narrow ? (
        <div
          data-testid="pane-switch"
          className="absolute inset-x-0 bottom-0 z-30 flex gap-2 border-t border-black/5 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            aria-pressed={mobilePane === "map"}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-medium ${mobilePane === "map" ? "bg-brand-soft text-[#2F6FEB]" : "text-[#67707D]"}`}
            onClick={() => setMobilePane("map")}
          >
            脑图
          </button>
          <button
            type="button"
            aria-pressed={mobilePane === "doc"}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-medium ${mobilePane === "doc" ? "bg-brand-soft text-[#2F6FEB]" : "text-[#67707D]"}`}
            onClick={() => setMobilePane("doc")}
          >
            文档
          </button>
        </div>
      ) : null}
    </div>
  );
}
