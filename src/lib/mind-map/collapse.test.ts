import { expect, test } from "vitest";
import { hiddenNodeIds } from "./collapse";

test("collapsing a card hides its child branch and keeps unrelated cards", () => {
  const hidden = hiddenNodeIds(
    [
      { id: "parent", collapsed: true },
      { id: "child" },
      { id: "grand" },
      { id: "note" },
    ],
    [
      { source: "parent", target: "child", kind: "child" },
      { source: "child", target: "grand", kind: "child" },
      { source: "parent", target: "note", kind: "relates" },
    ],
  );
  expect([...hidden].sort()).toEqual(["child", "grand"]);
});

test("an expanded card keeps its children visible", () => {
  expect(
    hiddenNodeIds(
      [{ id: "parent", collapsed: false }, { id: "child" }],
      [{ source: "parent", target: "child", kind: "child" }],
    ).size,
  ).toBe(0);
});
