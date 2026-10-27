import { expect, test } from "vitest";
import { clampSplitRatio, layoutForWidth, paneHidden, ratioFromPointer } from "./split";

test("split ratio stays inside the draggable range", () => {
  expect(clampSplitRatio(10)).toBe(22);
  expect(clampSplitRatio(90)).toBe(78);
  expect(clampSplitRatio(46)).toBe(46);
  expect(clampSplitRatio(Number.NaN)).toBe(46);
});

test("pointer position becomes the mind-pane ratio", () => {
  expect(
    ratioFromPointer({ layout: "split", client: 640, origin: 0, span: 1280 }),
  ).toBe(50);
  expect(
    ratioFromPointer({ layout: "stack", client: 200, origin: 0, span: 800 }),
  ).toBe(25);
});

test("one side can collapse and narrow widths stack", () => {
  expect(paneHidden("doc", "doc")).toBe(true);
  expect(paneHidden("doc", "map")).toBe(false);
  expect(paneHidden(null, "map")).toBe(false);
  expect(layoutForWidth(390)).toBe("stack");
  expect(layoutForWidth(1280)).toBe("split");
  expect(layoutForWidth(767)).toBe("stack");
  expect(layoutForWidth(768)).toBe("split");
});
