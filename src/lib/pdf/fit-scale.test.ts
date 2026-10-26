import { expect, test } from "vitest";
import { PDF_CSS_SCALE, pdfFitScale } from "./fit-scale";

test("a letter page scales down to a phone and stays sharp on a wide screen", () => {
  expect(pdfFitScale(612, 390)).toBeCloseTo(389 / 612);
  expect(pdfFitScale(612, 390)).toBeLessThan(1);
  expect(pdfFitScale(612, 1400)).toBeCloseTo(PDF_CSS_SCALE);
});
