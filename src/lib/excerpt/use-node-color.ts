"use client";

import { useEffect } from "react";
import { NODE_COLOR_EVENT } from "@/src/lib/excerpt/colors";

type ColoredNode = { id: string; payload: Record<string, unknown> };

export function useNodeColorSync<T extends ColoredNode>(setExcerpts: (value: T[] | ((current: T[]) => T[])) => void) {
  useEffect(() => {
    function onColor(event: Event) {
      const detail = (event as CustomEvent<{ id?: string; color?: number }>).detail;
      if (!detail?.id || typeof detail.color !== "number") return;
      const { id, color } = detail;
      setExcerpts((current) =>
        current.map((node) => (node.id === id ? { ...node, payload: { ...node.payload, color } } : node)),
      );
    }
    window.addEventListener(NODE_COLOR_EVENT, onColor);
    return () => window.removeEventListener(NODE_COLOR_EVENT, onColor);
  }, [setExcerpts]);
}
