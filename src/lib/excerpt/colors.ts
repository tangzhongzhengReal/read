export type ExcerptColor = {
  id: number;
  hex: string;
  name: string;
};

/** MarginNote 16 色摘录色板。1 号是手册里的事实色，其余为截图取样。 */
export const EXCERPT_COLORS: readonly ExcerptColor[] = [
  { id: 1, hex: "#FEFFAA", name: "浅黄" },
  { id: 2, hex: "#C0FEBE", name: "浅绿" },
  { id: 3, hex: "#ADD1FE", name: "浅蓝" },
  { id: 4, hex: "#FFAAC0", name: "浅粉" },
  { id: 5, hex: "#FFFF00", name: "亮黄" },
  { id: 6, hex: "#05FF00", name: "亮绿" },
  { id: 7, hex: "#00BEFF", name: "亮蓝" },
  { id: 8, hex: "#FF0000", name: "红" },
  { id: 9, hex: "#FE8002", name: "橙" },
  { id: 10, hex: "#018144", name: "深绿" },
  { id: 11, hex: "#003FB4", name: "深蓝" },
  { id: 12, hex: "#CE1C14", name: "深红" },
  { id: 13, hex: "#FFFFFF", name: "白" },
  { id: 14, hex: "#DBDBDB", name: "浅灰" },
  { id: 15, hex: "#B4B4B4", name: "中灰" },
  { id: 16, hex: "#C49DE3", name: "浅紫" },
];

/** 选中文字气泡里先露出的 8 色。 */
export const POPOVER_COLOR_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type HighlightMode = "fill" | "underline";

export function excerptColor(id: number | undefined): ExcerptColor {
  const found = EXCERPT_COLORS.find((color) => color.id === id);
  return found ?? EXCERPT_COLORS[0]!;
}

export function titleBarColor(hex: string): string {
  return `color-mix(in srgb, ${hex} 42%, white)`;
}

export const NODE_COLOR_EVENT = "read:node-color";

export function publishNodeColor(id: string, color: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NODE_COLOR_EVENT, { detail: { id, color } }));
}

export function highlightPresentation(input: {
  color?: number;
  highlight?: HighlightMode;
  asTitle?: boolean;
}): { mode: "fill" | "underline" | "title"; color: string } {
  if (input.asTitle) return { mode: "title", color: "#2233D9" };
  const color = excerptColor(input.color).hex;
  if (input.highlight === "underline") return { mode: "underline", color };
  return { mode: "fill", color };
}
