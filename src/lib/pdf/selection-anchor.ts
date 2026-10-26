export type SelectionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SelectionAnchor = {
  page: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
};

export function normalizeSelectionAnchor(input: {
  page: number;
  pageBox: SelectionBox;
  clientRects: SelectionBox[];
}): SelectionAnchor {
  if (input.pageBox.width <= 0 || input.pageBox.height <= 0) {
    return { page: input.page, rects: [] };
  }

  const rects = input.clientRects
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: (rect.left - input.pageBox.left) / input.pageBox.width,
      y: (rect.top - input.pageBox.top) / input.pageBox.height,
      width: rect.width / input.pageBox.width,
      height: rect.height / input.pageBox.height,
    }));

  return { page: input.page, rects };
}
