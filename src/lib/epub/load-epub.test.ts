import type { Book } from "epubjs";
import { expect, test } from "vitest";
import {
  EPUB_ARCHIVE_OPTIONS,
  downloadEpubBytes,
  epubFileUrl,
  epubStageLabel,
  openEpubBook,
} from "./load-epub";

test("stage labels describe download and parse instead of a single waiting line", () => {
  expect(epubStageLabel("preparing", null)).toBe("正在准备阅读器…");
  expect(epubStageLabel("downloading", null)).toBe("正在下载 EPUB…");
  expect(epubStageLabel("downloading", 0.42)).toBe("正在下载 EPUB… 42%");
  expect(epubStageLabel("parsing", null)).toBe("正在解析 EPUB…");
  expect(epubStageLabel("rendering", null)).toBe("正在排版…");
  expect(epubStageLabel("preparing", null)).not.toBe("正在打开 EPUB…");
});

test("epub file urls stay on the authenticated file route", () => {
  expect(epubFileUrl("doc/1", "w s")).toBe("/api/documents/doc%2F1/file?workspaceId=w+s");
});

test("download reports progress from the response stream", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3, 4]));
      controller.close();
    },
  });
  const ratios: Array<number | null> = [];
  const bytes = await downloadEpubBytes(
    "/file.epub",
    async () => new Response(stream, { status: 200, headers: { "content-length": "4" } }),
    (ratio) => ratios.push(ratio),
  );
  expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  expect(ratios).toContain(0.5);
  expect(ratios.at(-1)).toBe(1);
});

test("a failed download does not pretend the book opened", async () => {
  await expect(
    downloadEpubBytes("/missing", async () => new Response("no", { status: 404 }), () => {}),
  ).rejects.toThrow("无法打开 EPUB");
});

test("opening starts the runtime and the download together, then uses a blob url", async () => {
  let fetchStarted = false;
  let resolveRuntime: (mod: {
    default: (href: string, options: typeof EPUB_ARCHIVE_OPTIONS) => Book;
  }) => void = () => {};
  const runtime = new Promise<{
    default: (href: string, options: typeof EPUB_ARCHIVE_OPTIONS) => Book;
  }>((resolve) => {
    resolveRuntime = resolve;
  });
  const stages: string[] = [];
  let seenHref = "";
  let seenOptions: unknown;

  const opened = openEpubBook({
    url: "/api/documents/doc/file?workspaceId=local",
    loadRuntime: () => runtime,
    createObjectURL: () => "blob:read-epub",
    fetchImpl: async () => {
      fetchStarted = true;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([9, 8, 7]));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-length": "3" } });
    },
    onStage: (stage) => stages.push(stage),
  });

  await Promise.resolve();
  expect(fetchStarted).toBe(true);

  resolveRuntime({
    default(href, options) {
      seenHref = href;
      seenOptions = options;
      return { ready: Promise.resolve() } as Book;
    },
  });

  const result = await opened;
  expect(seenHref).toBe("blob:read-epub");
  expect(seenOptions).toEqual({ replacements: "none", openAs: "epub" });
  expect(result.href).toBe("blob:read-epub");
  expect(stages).toEqual(expect.arrayContaining(["preparing", "downloading", "parsing"]));
  expect(stages.indexOf("downloading")).toBeGreaterThanOrEqual(0);
  expect(stages.at(-1)).toBe("parsing");
});
