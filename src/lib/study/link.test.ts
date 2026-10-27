import { expect, test } from "vitest";
import { focusesDocument, focusesMap, locateFromAnchor } from "./link";

test("link mode gates each direction", () => {
  expect(focusesMap("off")).toBe(false);
  expect(focusesDocument("off")).toBe(false);
  expect(focusesMap("doc-to-map")).toBe(true);
  expect(focusesDocument("doc-to-map")).toBe(false);
  expect(focusesMap("map-to-doc")).toBe(false);
  expect(focusesDocument("map-to-doc")).toBe(true);
  expect(focusesMap("both")).toBe(true);
  expect(focusesDocument("both")).toBe(true);
});

test("pdf anchors locate a page and rects", () => {
  expect(
    locateFromAnchor({
      page: 2,
      rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
    }),
  ).toEqual({
    kind: "pdf",
    page: 2,
    rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
  });
  expect(locateFromAnchor({ page: 0, rects: [{ x: 0, y: 0, width: 1, height: 1 }] })).toBeNull();
  expect(locateFromAnchor({ page: 1, rects: [] })).toBeNull();
});

test("epub anchors locate a cfi", () => {
  expect(locateFromAnchor({ cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)" })).toEqual({
    kind: "epub",
    cfi: "epubcfi(/6/4!/4/2,/1:0,/1:12)",
  });
  expect(locateFromAnchor({ cfi: "not-a-cfi" })).toBeNull();
  expect(locateFromAnchor(null)).toBeNull();
});
