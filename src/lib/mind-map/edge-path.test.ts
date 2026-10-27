import { expect, test } from "vitest";
import { orthogonalEdgePath } from "./edge-path";

test("mind-map edges are orthogonal polylines, not curves between the ends", () => {
  const path = orthogonalEdgePath(0, 20, 200, 120);
  expect(path.startsWith("M 0 20")).toBe(true);
  expect(path).toContain("H ");
  expect(path).toContain("V ");
  expect(path).toContain("Q ");
  expect(path).not.toMatch(/\bC /);
  expect(orthogonalEdgePath(10, 40, 80, 40)).toBe("M 10 40 H 80");
});
