import { beforeEach, expect, test, vi } from "vitest";

vi.mock("epubjs", () => ({
  default: () => ({ mocked: true }),
}));

import { prefetchEpubRuntime, resetEpubRuntimeForTests } from "./runtime";

beforeEach(() => {
  resetEpubRuntimeForTests();
});

test("the epub.js runtime is loaded once and reused", async () => {
  resetEpubRuntimeForTests();
  const first = prefetchEpubRuntime();
  const second = prefetchEpubRuntime();
  expect(second).toBe(first);
  const loaded = await first;
  expect(typeof loaded.default).toBe("function");
});
