type EpubModule = typeof import("epubjs");

let runtimePromise: Promise<EpubModule> | null = null;

export function prefetchEpubRuntime(): Promise<EpubModule> {
  if (!runtimePromise) {
    runtimePromise = import("epubjs");
  }
  return runtimePromise;
}

export function resetEpubRuntimeForTests(): void {
  runtimePromise = null;
}
