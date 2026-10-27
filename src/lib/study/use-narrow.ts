"use client";

import { useSyncExternalStore } from "react";

const NARROW_QUERY = "(max-width: 767px)";

function subscribe(callback: () => void) {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}
