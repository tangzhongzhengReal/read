export type LinkMode = "off" | "doc-to-map" | "map-to-doc" | "both";

export const LINK_MODES: readonly LinkMode[] = ["both", "doc-to-map", "map-to-doc", "off"];

export type PdfLocate = {
  kind: "pdf";
  page: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
};

export type EpubLocate = {
  kind: "epub";
  cfi: string;
};

export type LocateTarget = PdfLocate | EpubLocate;

export type LocateRequest = {
  token: number;
  nodeId: string;
  anchor: unknown;
};

const rect = {
  x: (value: unknown) => typeof value === "number" && Number.isFinite(value),
};

export function focusesMap(mode: LinkMode): boolean {
  return mode === "both" || mode === "doc-to-map";
}

export function focusesDocument(mode: LinkMode): boolean {
  return mode === "both" || mode === "map-to-doc";
}

export function linkModeLabel(mode: LinkMode): string {
  if (mode === "both") return "双向";
  if (mode === "doc-to-map") return "文档 → 脑图";
  if (mode === "map-to-doc") return "脑图 → 文档";
  return "关闭";
}

export function locateFromAnchor(anchor: unknown): LocateTarget | null {
  if (!anchor || typeof anchor !== "object") return null;
  const record = anchor as Record<string, unknown>;
  if (typeof record.cfi === "string" && /^epubcfi\([\s\S]+\)$/.test(record.cfi)) {
    return { kind: "epub", cfi: record.cfi };
  }
  if (typeof record.page !== "number" || !Number.isInteger(record.page) || record.page < 1) return null;
  if (!Array.isArray(record.rects) || record.rects.length === 0) return null;
  const rects = record.rects.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const box = item as Record<string, unknown>;
    if (!rect.x(box.x) || !rect.x(box.y) || !rect.x(box.width) || !rect.x(box.height)) return [];
    if ((box.width as number) <= 0 || (box.height as number) <= 0) return [];
    return [
      {
        x: box.x as number,
        y: box.y as number,
        width: box.width as number,
        height: box.height as number,
      },
    ];
  });
  if (rects.length === 0) return null;
  return { kind: "pdf", page: record.page, rects };
}
