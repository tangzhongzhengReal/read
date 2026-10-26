"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LOCAL_WORKSPACE_ID } from "@/src/lib/workspace";

const MindMapCanvas = dynamic(() => import("@/components/mind-map-canvas"), {
  ssr: false,
  loading: () => <p className="px-6 py-10">正在打开脑图…</p>,
});

export function MindMap() {
  const params = useSearchParams();
  const workspaceId = params.get("workspaceId") || LOCAL_WORKSPACE_ID;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground">脑图</p>
            <h1 className="text-xl leading-none font-semibold">Read</h1>
          </div>
          <Link className="text-sm underline" href="/">
            返回文库
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">
        <MindMapCanvas workspaceId={workspaceId} />
      </main>
    </div>
  );
}
