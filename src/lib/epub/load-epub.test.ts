import { readFileSync } from "node:fs";
import path from "node:path";
import type { Book } from "epubjs";
import { expect, test } from "vitest";
import {
  EPUB_ARCHIVE_OPTIONS,
  EPUB_RENDER_FAILURE_MESSAGE,
  EPUB_RENDER_TIMEOUT_MESSAGE,
  displayEpubSection,
  downloadEpubBytes,
  epubFileUrl,
  epubStageLabel,
  openEpubBook,
  type EpubDisplayTarget,
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

test("opening rewrites tuple paths before epub.js fetches the blob", async () => {
  const fixture = readFileSync(path.join(process.cwd(), "fixtures/epub/malformed-tuple-paths.epub"));
  let archivedPromise = Promise.resolve(new Uint8Array());
  await openEpubBook({
    url: "/book.epub",
    fetchImpl: async () => new Response(fixture, { status: 200 }),
    createObjectURL: (blob) => {
      archivedPromise = blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
      return "blob:sanitized-epub";
    },
    loadRuntime: async () => ({
      default() {
        return { ready: Promise.resolve() } as Book;
      },
    }),
  });
  const text = Buffer.from(await archivedPromise).toString("latin1");
  expect(text.includes("('chapter0.xhtml',)")).toBe(false);
  expect(text.includes("chapter2.xhtml")).toBe(true);
  expect(text.includes("stylesheets.css")).toBe(false);
});

test("a rendition that never finishes rejects instead of hanging", async () => {
  const rendition = fakeRendition(() => new Promise<void>(() => {}));
  await expect(displayEpubSection(rendition, undefined, 30)).rejects.toThrow(EPUB_RENDER_TIMEOUT_MESSAGE);
});

test("display errors surface immediately when epub.js swallows the promise", async () => {
  const rendition = fakeRendition(
    () => new Promise<void>(() => {}),
    new TypeError("doc.createElement is not a function"),
  );
  const started = Date.now();
  await expect(displayEpubSection(rendition, undefined, 5_000)).rejects.toThrow(
    EPUB_RENDER_FAILURE_MESSAGE,
  );
  expect(Date.now() - started).toBeLessThan(1_000);
});

test("a finished rendition is not reported as a timeout", async () => {
  const rendition = fakeRendition(async () => {});
  await expect(displayEpubSection(rendition, "epubcfi(/6/2)", 50)).resolves.toBeUndefined();
});

function fakeRendition(
  display: (target?: string) => Promise<void>,
  emitError?: unknown,
): EpubDisplayTarget {
  const listeners = new Set<(error: unknown) => void>();
  return {
    display: (target) => {
      const pending = display(target);
      if (emitError !== undefined) {
        queueMicrotask(() => {
          for (const listener of listeners) listener(emitError);
        });
      }
      return pending;
    },
    on(_event, listener) {
      listeners.add(listener);
    },
    off(_event, listener) {
      listeners.delete(listener);
    },
  };
}
