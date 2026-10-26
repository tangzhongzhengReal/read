"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { libraryPath, LOCAL_WORKSPACE_ID, reviewPath } from "@/src/lib/workspace";

const MindMapCanvas = dynamic(() => import("@/components/mind-map-canvas"), {
  ssr: false,
  loading: () => <p className="px-6 py-10">正在打开脑图…</p>,
});

export function MindMap() {
  const params = useSearchParams();
  const workspaceId = params.get("workspaceId") || LOCAL_WORKSPACE_ID;

  return (
    <div className="min-h-svh overflow-x-clip bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground">脑图</p>
            <h1 className="text-xl leading-none font-semibold">Read</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link data-testid="open-review" className="inline-flex min-h-11 items-center underline" href={reviewPath(workspaceId)}>
              复习
            </Link>
            <Link className="inline-flex min-h-11 items-center underline" href={libraryPath(workspaceId)}>
              返回文库
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <MindMapCanvas workspaceId={workspaceId} />
      </main>
    </div>
  );
}
