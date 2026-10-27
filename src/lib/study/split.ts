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

export function layoutForWidth(width: number): SplitLayout {
  return width < 768 ? "stack" : "split";
}
