"use client";

import { useEffect, useRef, useState } from "react";
import { POPOVER_COLOR_IDS, excerptColor, type HighlightMode } from "@/src/lib/excerpt/colors";

export type PopoverAnchor = {
  x: number;
  y: number;
};

export function ExcerptPopover({
  anchor,
  color,
  highlight,
  onColor,
  onHighlight,
  onExcerpt,
  onTitle,
  onComment,
  onDismiss,
}: {
  anchor: PopoverAnchor | null;
  color: number;
  highlight: HighlightMode;
  onColor: (id: number) => void;
  onHighlight: (mode: HighlightMode) => void;
  onExcerpt: () => void;
  onTitle: () => void;
  onComment: (comment: string) => void;
  onDismiss: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!anchor) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (target.closest("[data-testid='pdf-text-layer'], [data-testid='epub-viewer'], [data-testid='create-excerpt']")) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [anchor, onDismiss]);

  if (!anchor) return null;

  return (
    <div
      ref={rootRef}
      data-testid="excerpt-popover"
      className="fixed z-50 w-[17.5rem] -translate-x-1/2 rounded-2xl bg-menu-dark px-3 py-2 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
      style={{ left: anchor.x, top: anchor.y + 8 }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="flex flex-wrap gap-1">
        <button type="button" data-testid="popover-excerpt" className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium" onClick={onExcerpt}>
          摘录
        </button>
        <button type="button" data-testid="popover-excerpt-title" className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium" onClick={onTitle}>
          摘录为标题
        </button>
        <button
          type="button"
          data-testid="popover-comment"
          className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium"
          onClick={() => setCommenting((current) => !current)}
        >
          评论
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {POPOVER_COLOR_IDS.map((id) => {
          const swatch = excerptColor(id);
          const selected = color === id;
          return (
            <button
              key={id}
              type="button"
              data-testid="excerpt-color"
              data-color={id}
              aria-label={swatch.name}
              className="size-6 rounded-md ring-2 ring-transparent"
              style={{
                background: swatch.hex,
                boxShadow: selected ? "0 0 0 2px #fff, 0 0 0 3px #4894F3" : "inset 0 0 0 1px rgba(0,0,0,.15)",
              }}
              onClick={() => onColor(id)}
            />
          );
        })}
      </div>
      <div className="mt-2 flex gap-1">
        <button
          type="button"
          data-testid="excerpt-style-fill"
          data-active={highlight === "fill" ? "true" : "false"}
          className="rounded-lg px-2 py-1 text-xs"
          style={{ background: highlight === "fill" ? "#4894F3" : "rgba(255,255,255,.1)" }}
          onClick={() => onHighlight("fill")}
        >
          填充
        </button>
        <button
          type="button"
          data-testid="excerpt-style-underline"
          data-active={highlight === "underline" ? "true" : "false"}
          className="rounded-lg px-2 py-1 text-xs"
          style={{ background: highlight === "underline" ? "#4894F3" : "rgba(255,255,255,.1)" }}
          onClick={() => onHighlight("underline")}
        >
          下划线
        </button>
      </div>
      {commenting ? (
        <form
          className="mt-2 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            const text = comment.trim();
            if (!text) return;
            onComment(text);
            setComment("");
            setCommenting(false);
          }}
        >
          <input
            data-testid="popover-comment-input"
            className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1 text-xs text-[#1C1C1E]"
            value={comment}
            placeholder="写评论"
            onChange={(event) => setComment(event.target.value)}
          />
          <button type="submit" data-testid="popover-comment-save" className="rounded-lg bg-brand px-2 py-1 text-xs">
            保存
          </button>
        </form>
      ) : null}
    </div>
  );
}
