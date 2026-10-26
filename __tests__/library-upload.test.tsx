/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import Home from "../app/page";

afterEach(() => {
  cleanup();
});

test("library can upload a pdf", () => {
  render(<Home />);

  expect(screen.getByTestId("upload-pdf")).toBeDefined();
  expect(screen.getByText("导入 PDF")).toBeDefined();
});

test("library can upload an epub", () => {
  render(<Home />);

  expect(screen.getByTestId("upload-epub")).toBeDefined();
  expect(screen.getByText("导入 EPUB")).toBeDefined();
});
