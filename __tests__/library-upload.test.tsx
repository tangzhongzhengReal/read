/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "../app/page";

test("library can upload a pdf", () => {
  render(<Home />);

  expect(screen.getByTestId("upload-pdf")).toBeDefined();
  expect(screen.getByText("导入 PDF")).toBeDefined();
});
