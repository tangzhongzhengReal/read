export type SplitLayout = "split" | "stack";
export type CollapsedPane = "map" | "doc" | null;

export const SPLIT_MIN = 22;
export const SPLIT_MAX = 78;
export const SPLIT_DEFAULT = 46;

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio));
}

export function ratioFromPointer(input: {
  layout: SplitLayout;
  client: number;
  origin: number;
  span: number;
}): number {
  if (input.span <= 0) return SPLIT_DEFAULT;
  return clampSplitRatio(((input.client - input.origin) / input.span) * 100);
}

export function paneHidden(collapsed: CollapsedPane, pane: "map" | "doc"): boolean {
  return collapsed === pane;
}

/** Collapse a pane, or restore it when that pane is already the one hidden. */
export function togglePane(current: CollapsedPane, pane: "map" | "doc"): CollapsedPane {
  return current === pane ? null : pane;
}

export function paneToggleLabel(collapsed: CollapsedPane, pane: "map" | "doc"): string {
  const name = pane === "map" ? "脑图" : "文档";
  return collapsed === pane ? `展开${name}` : `收起${name}`;
}

export function layoutForWidth(width: number): SplitLayout {
  return width < 768 ? "stack" : "split";
}
