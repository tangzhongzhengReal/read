import { expect, test } from "vitest";
import { normalizeSelectionAnchor } from "./selection-anchor";

test("selection rectangles are stored as page fractions", () => {
  const anchor = normalizeSelectionAnchor({
    page: 2,
    pageBox: { left: 100, top: 50, width: 200, height: 400 },
    clientRects: [
      { left: 120, top: 90, width: 50, height: 100 },
      { left: 100, top: 50, width: 0, height: 10 },
    ],
  });

  expect(anchor).toEqual({
    page: 2,
    rects: [{ x: 0.1, y: 0.1, width: 0.25, height: 0.25 }],
  });
});
