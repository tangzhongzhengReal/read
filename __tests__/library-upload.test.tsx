/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Home from "../app/page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

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

test("library links to the workspace mind map", () => {
  render(<Home />);

  expect(screen.getByTestId("open-mind-map").getAttribute("href")).toBe("/map");
});

test("library can create a workspace and open today's review", () => {
  render(<Home />);

  expect(screen.getByTestId("create-workspace")).toBeDefined();
  expect(screen.getByTestId("open-review").getAttribute("href")).toBe("/review");
});
