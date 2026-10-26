/**
 * @vitest-environment jsdom
 */
import { existsSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "../app/page";

test("home page is the library shell, not the static Hello World", () => {
  render(<Home />);

  expect(screen.getByTestId("app-shell")).toBeDefined();
  expect(screen.getByTestId("library-empty")).toBeDefined();
  expect(screen.getByRole("heading", { level: 1, name: "Read" })).toBeDefined();
  expect(screen.queryByText(/hello world/i)).toBeNull();
  expect(existsSync("index.html")).toBe(false);
});
