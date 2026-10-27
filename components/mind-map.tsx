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
    <div className="min-h-svh overflow-x-clip bg-canvas text-[#1C1C1E]">
      <header className="px-4 pt-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-full bg-white px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <div>
            <p className="text-xs tracking-wide text-[#9A9A9A]">脑图</p>
            <h1 className="text-lg leading-none font-semibold">Read</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link data-testid="open-review" className="inline-flex min-h-11 items-center rounded-full px-3 text-[#67707D]" href={reviewPath(workspaceId)}>
              复习
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-full px-3 text-[#67707D]" href={libraryPath(workspaceId)}>
              文库
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <MindMapCanvas workspaceId={workspaceId} />
      </main>
    </div>
  );
}
