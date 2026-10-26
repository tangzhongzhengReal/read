/**
 * @vitest-environment jsdom
 */
import { existsSync } from "node:fs";
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

test("home page is the library shell, not the static Hello World", () => {
  render(<Home />);

  expect(screen.getByTestId("app-shell")).toBeDefined();
  expect(screen.getByTestId("library-empty")).toBeDefined();
  expect(screen.getByRole("heading", { level: 1, name: "Read" })).toBeDefined();
  expect(screen.queryByText(/hello world/i)).toBeNull();
  expect(existsSync("index.html")).toBe(false);
});
