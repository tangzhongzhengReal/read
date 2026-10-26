import type { Book } from "epubjs";
import { prefetchEpubRuntime } from "@/src/lib/epub/runtime";
import { sanitizeEpubArchive } from "@/src/lib/epub/sanitize-archive";

export type EpubOpenStage = "preparing" | "downloading" | "parsing" | "rendering";

export const EPUB_RENDER_TIMEOUT_MS = 10_000;
export const EPUB_RENDER_TIMEOUT_MESSAGE = "排版超时，无法显示这一页";
export const EPUB_RENDER_FAILURE_MESSAGE = "无法完成排版";

export type EpubDisplayTarget = {
  display: (target?: string) => Promise<unknown>;
  on: (event: "displayerror", listener: (error: unknown) => void) => void;
  off: (event: "displayerror", listener: (error: unknown) => void) => void;
};

export const EPUB_ARCHIVE_OPTIONS = {
  replacements: "none",
  openAs: "epub",
} as const;

export function epubFileUrl(documentId: string, workspaceId: string): string {
  const params = new URLSearchParams({ workspaceId });
  return `/api/documents/${encodeURIComponent(documentId)}/file?${params.toString()}`;
}

export function epubStageLabel(stage: EpubOpenStage, progress: number | null): string {
  if (stage === "preparing") return "正在准备阅读器…";
  if (stage === "downloading") {
    if (progress == null) return "正在下载 EPUB…";
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    return `正在下载 EPUB… ${percent}%`;
  }
  if (stage === "parsing") return "正在解析 EPUB…";
  return "正在排版…";
}

export function displayEpubSection(
  rendition: EpubDisplayTarget,
  target?: string,
  timeoutMs = EPUB_RENDER_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      finish(() => reject(new Error(EPUB_RENDER_TIMEOUT_MESSAGE)));
    }, timeoutMs);
    const onAbort = () => {
      finish(() => reject(new DOMException("The operation was aborted.", "AbortError")));
    };
    const onError = () => {
      finish(() => reject(new Error(EPUB_RENDER_FAILURE_MESSAGE)));
    };

    function finish(settle: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      rendition.off("displayerror", onError);
      settle();
    }

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    rendition.on("displayerror", onError);

    let pending: Promise<unknown>;
    try {
      pending = target === undefined ? rendition.display() : rendition.display(target);
    } catch (error) {
      pending = Promise.reject(error);
    }
    void pending.then(
      () => finish(() => resolve()),
      (error: unknown) => {
        finish(() => reject(error instanceof Error ? error : new Error(EPUB_RENDER_FAILURE_MESSAGE)));
      },
    );
  });
}

export async function downloadEpubBytes(
  url: string,
  fetchImpl: typeof fetch,
  onProgress: (ratio: number | null) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetchImpl(url, { signal, credentials: "same-origin" });
  if (!response.ok) throw new Error("无法打开 EPUB");
  const totalHeader = response.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : Number.NaN;
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress(1);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.byteLength;
    onProgress(Number.isFinite(total) && total > 0 ? Math.min(1, received / total) : null);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(received > 0 ? 1 : 0);
  return bytes;
}

type EpubFactoryModule = {
  default: (href: string, options: typeof EPUB_ARCHIVE_OPTIONS) => Book;
};

export async function openEpubBook(input: {
  url: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  loadRuntime?: () => Promise<EpubFactoryModule>;
  createObjectURL?: (blob: Blob) => string;
  onStage?: (stage: EpubOpenStage, progress: number | null) => void;
}): Promise<{ book: Book; href: string }> {
  const onStage = input.onStage ?? (() => {});
  onStage("preparing", null);
  const loadRuntime = input.loadRuntime ?? prefetchEpubRuntime;
  let runtimeReady = false;
  const runtimePromise = loadRuntime().then((mod) => {
    runtimeReady = true;
    return mod;
  });
  const bytes = await downloadEpubBytes(
    input.url,
    input.fetchImpl ?? fetch,
    (ratio) => onStage("downloading", ratio),
    input.signal,
  );
  if (!runtimeReady) onStage("preparing", null);
  const runtime = await runtimePromise;
  onStage("parsing", null);
  const prepared = await sanitizeEpubArchive(bytes);
  const copy = new ArrayBuffer(prepared.byteLength);
  new Uint8Array(copy).set(prepared);
  const href = (input.createObjectURL ?? URL.createObjectURL)(
    new Blob([copy], { type: "application/epub+zip" }),
  );
  const book = runtime.default(href, EPUB_ARCHIVE_OPTIONS);
  return { book, href };
}
