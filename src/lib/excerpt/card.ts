import type { HighlightMode } from "./colors";

export type CardFields = {
  text: string;
  title?: string;
  comment?: string;
  color?: number;
  tags: string[];
  highlight: HighlightMode;
  collapsed: boolean;
  asTitle: boolean;
};

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

export function readCardFields(payload: Record<string, unknown> | undefined): CardFields {
  const colorValue = payload?.color;
  const color =
    typeof colorValue === "number" && Number.isInteger(colorValue) && colorValue >= 1 && colorValue <= 16
      ? colorValue
      : undefined;
  const tags = Array.isArray(payload?.tags)
    ? payload.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= 40)
        .slice(0, 12)
    : [];
  return {
    text: typeof payload?.text === "string" ? payload.text : "",
    title: cleanString(payload?.title, 250),
    comment: cleanString(payload?.comment, 4000),
    color,
    tags,
    highlight: payload?.highlight === "underline" ? "underline" : "fill",
    collapsed: payload?.collapsed === true,
    asTitle: payload?.asTitle === true,
  };
}

export function cardExtras(fields: Partial<CardFields>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (fields.title) payload.title = fields.title;
  if (fields.comment) payload.comment = fields.comment;
  if (fields.color) payload.color = fields.color;
  if (fields.tags && fields.tags.length > 0) payload.tags = fields.tags;
  if (fields.highlight === "underline") payload.highlight = "underline";
  if (fields.collapsed) payload.collapsed = true;
  if (fields.asTitle) payload.asTitle = true;
  return payload;
}
