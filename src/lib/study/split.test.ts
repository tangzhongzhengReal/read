import { expect, test } from "vitest";
import { clampSplitRatio, layoutForWidth, paneHidden, paneToggleLabel, ratioFromPointer, togglePane } from "./split";

test("split ratio stays inside the draggable range", () => {
  expect(clampSplitRatio(10)).toBe(22);
  expect(clampSplitRatio(90)).toBe(78);
  expect(clampSplitRatio(46)).toBe(46);
  expect(clampSplitRatio(Number.NaN)).toBe(34);
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

test("collapse toggles back to both panes and the label follows", () => {
  expect(togglePane(null, "map")).toBe("map");
  expect(togglePane("map", "map")).toBe(null);
  expect(togglePane("doc", "map")).toBe("map");
  expect(togglePane("doc", "doc")).toBe(null);
  expect(paneToggleLabel(null, "map")).toBe("收起脑图");
  expect(paneToggleLabel("map", "map")).toBe("展开脑图");
  expect(paneToggleLabel(null, "doc")).toBe("收起文档");
  expect(paneToggleLabel("doc", "doc")).toBe("展开文档");
  expect(paneHidden(togglePane("map", "map"), "map")).toBe(false);
  expect(paneHidden(togglePane(null, "doc"), "doc")).toBe(true);
});
