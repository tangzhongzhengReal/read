import { expect, test } from "vitest";
import {
  EXCERPT_COLORS,
  POPOVER_COLOR_IDS,
  excerptColor,
  highlightPresentation,
  titleBarColor,
} from "./colors";

test("the excerpt palette has the sixteen MarginNote colors", () => {
  expect(EXCERPT_COLORS).toHaveLength(16);
  expect(EXCERPT_COLORS[0]).toMatchObject({ id: 1, hex: "#FEFFAA" });
  expect(EXCERPT_COLORS.map((color) => color.id)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  expect(new Set(EXCERPT_COLORS.map((color) => color.hex)).size).toBe(16);
});

test("the selection popover exposes at least eight colors", () => {
  expect(POPOVER_COLOR_IDS.length).toBeGreaterThanOrEqual(8);
  for (const id of POPOVER_COLOR_IDS) {
    expect(excerptColor(id).id).toBe(id);
  }
});

test("title bars are a light mix and title excerpts use a blue dashed underline", () => {
  expect(titleBarColor("#FEFFAA")).toContain("#FEFFAA");
  expect(highlightPresentation({ color: 3, highlight: "fill" })).toEqual({
    mode: "fill",
    color: "#ADD1FE",
  });
  expect(highlightPresentation({ color: 8, highlight: "underline" })).toEqual({
    mode: "underline",
    color: "#FF0000",
  });
  expect(highlightPresentation({ color: 1, asTitle: true, highlight: "underline" })).toEqual({
    mode: "title",
    color: "#2233D9",
  });
  expect(excerptColor(undefined).id).toBe(1);
  expect(excerptColor(99).id).toBe(1);
});
