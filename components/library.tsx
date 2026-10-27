"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Folder, Library as LibraryIcon, Menu, Plus, RotateCcw } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { LOCAL_WORKSPACE_ID, mapPath, reviewPath, studyPath } from "@/src/lib/workspace";

type LibraryDocument = {
  id: string;
  workspaceId: string;
  title: string;
  mediaType: string;
  meta?: { pages?: number };
};

type WorkspaceRecord = {
  id: string;
  name: string;
};

export function Library() {
  const params = useSearchParams();
  const router = useRouter();
  const workspaceId = params.get("workspaceId") || LOCAL_WORKSPACE_ID;
  const [workspaceName, setWorkspaceName] = useState("本地");
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [draftName, setDraftName] = useState("");
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<"sets" | "docs">("docs");
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!navOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [workspaceResponse, documentResponse] = await Promise.all([
          fetch("/api/workspaces"),
          fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`),
        ]);
        if (!workspaceResponse.ok || !documentResponse.ok) throw new Error("无法读取文库");
        const workspaceBody = (await workspaceResponse.json()) as { workspaces: WorkspaceRecord[] };
        const documentBody = (await documentResponse.json()) as { documents: LibraryDocument[] };
        if (cancelled) return;
        const current = workspaceBody.workspaces.find((workspace) => workspace.id === workspaceId);
        setWorkspaces(workspaceBody.workspaces);
        setWorkspaceName(current?.name ?? (workspaceId === LOCAL_WORKSPACE_ID ? "本地" : workspaceId));
        setDocuments(documentBody.documents);
      } catch {
        if (!cancelled) {
          setWorkspaceName(workspaceId === LOCAL_WORKSPACE_ID ? "本地" : workspaceId);
          setDocuments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function createWorkspace() {
    const name = draftName.trim();
    if (!name) return;
    setError(null);
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError("无法新建工作区。");
      return;
    }
    const body = (await response.json()) as { workspace: { id: string } };
    router.push(`/?workspaceId=${encodeURIComponent(body.workspace.id)}`);
  }

  async function onFile(file: File) {
    setError(null);
    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("file", file);
    const response = await fetch("/api/documents/upload", { method: "POST", body: form });
    if (!response.ok) {
      setError(response.status === 415 ? "只能导入 PDF 或 EPUB。" : "导入失败。");
      return;
    }
    const body = (await response.json()) as { document: { id: string; workspaceId: string } };
    window.location.assign(studyPath(body.document.workspaceId, body.document.id));
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-canvas text-[#1C1C1E] md:flex-row">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-[#EFEFEF] bg-white px-2 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1 md:hidden">
        <button
          type="button"
          data-testid="library-menu"
          aria-label="打开导航"
          className="grid size-11 place-items-center rounded-lg"
          onClick={() => setNavOpen(true)}
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </button>
        <p className="text-base font-semibold">Read</p>
      </header>
      {navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="关闭导航"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside
        data-testid="library-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col bg-surface shadow-xl transition-transform md:static md:z-auto md:h-auto md:min-h-svh md:w-60 md:max-w-none md:translate-x-0 md:shadow-none ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-white">R</div>
          <h1 className="text-lg leading-none font-semibold tracking-tight">Read</h1>
        </div>
        <div className="px-4 pb-3">
          <p data-testid="workspace-title" className="truncate text-sm font-medium">
            {workspaceName}
          </p>
          <p data-testid="workspace-id" className="truncate text-xs text-[#9A9A9A]">
            {workspaceId}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-5 px-3 pb-4 text-sm">
          <section data-testid="library-section-study">
            <p className="px-2 pb-1 text-xs text-[#9A9A9A]">学习集</p>
            <button
              type="button"
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left ${section === "sets" ? "bg-surface-sel text-[#2F6FEB]" : "text-[#1C1C1E]"}`}
              onClick={() => setSection("sets")}
            >
              <LibraryIcon className="size-4 text-icon" strokeWidth={1.75} />
              学习集库
            </button>
            <Link
              data-testid="open-study-set"
              href={studyPath(workspaceId)}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2"
            >
              <BookOpen className="size-4 text-icon" strokeWidth={1.75} />
              进入学习集
            </Link>
            <Link data-testid="open-mind-map" href={mapPath(workspaceId)} className="flex min-h-11 items-center gap-2 rounded-lg px-2" onClick={() => setNavOpen(false)}>
              脑图
            </Link>
            <form
              className="mt-2 flex flex-col gap-2 px-1"
              onSubmit={(event) => {
                event.preventDefault();
                void createWorkspace();
              }}
            >
              <input
                data-testid="workspace-name"
                className="min-h-11 w-full rounded-lg border border-[#E6E6E6] bg-white px-3 text-base md:text-sm"
                value={draftName}
                placeholder="工作区名称"
                onChange={(event) => setDraftName(event.target.value)}
              />
              <button
                type="submit"
                data-testid="create-workspace"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E6E6E6] bg-white px-3 text-sm font-medium"
              >
                新建工作区
              </button>
            </form>
            {workspaces.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1" data-testid="workspace-list">
                {workspaces.map((workspace) => {
                  const selected = workspace.id === workspaceId;
                  return (
                    <li key={workspace.id}>
                      <Link
                        data-testid="workspace-link"
                        className={`block rounded-lg px-2 py-2 ${selected ? "bg-surface-sel text-[#2F6FEB]" : ""}`}
                        href={`/?workspaceId=${encodeURIComponent(workspace.id)}`}
                      >
                        {workspace.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
          <section data-testid="library-section-docs">
            <p className="px-2 pb-1 text-xs text-[#9A9A9A]">文档</p>
            <button
              type="button"
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left ${section === "docs" ? "bg-surface-sel text-[#2F6FEB]" : ""}`}
              onClick={() => setSection("docs")}
            >
              分类
            </button>
            <p className="mt-1 flex items-center gap-2 px-2 py-2 text-[#67707D]">
              <Folder className="size-4" strokeWidth={1.75} />
              文件夹
            </p>
            <p className="rounded-lg bg-surface-sel px-2 py-2 text-[#2F6FEB]">本地文件夹</p>
          </section>
          <section data-testid="library-section-review">
            <p className="px-2 pb-1 text-xs text-[#9A9A9A]">复习</p>
            <Link data-testid="open-review" href={reviewPath(workspaceId)} className="flex min-h-11 items-center gap-2 rounded-lg px-2" onClick={() => setNavOpen(false)}>
              <RotateCcw className="size-4 text-icon" strokeWidth={1.75} />
              复习卡片组
            </Link>
          </section>
        </nav>
        <div className="border-t border-[#EFEFEF] px-3 py-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-8 md:pb-5">
        <h2 className="text-center text-base font-medium">{section === "sets" ? "学习集" : "文档"}</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#8E8E93]">{section === "sets" ? "学习集库" : "全部"}</p>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg bg-[#4894F3] px-3 text-sm font-medium text-white shadow-sm">
              <Plus className="size-4" strokeWidth={2} />
              导入 PDF
              <input
                data-testid="upload-pdf"
                className="sr-only"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void onFile(file);
                }}
              />
            </label>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-[#4894F3] px-3 text-sm font-medium text-white shadow-sm">
              导入 EPUB
              <input
                data-testid="upload-epub"
                className="sr-only"
                type="file"
                accept="application/epub+zip,.epub"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void onFile(file);
                }}
              />
            </label>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {section === "sets" ? (
          <ul data-testid="library-grid" className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            <li>
              <Link href={studyPath(workspaceId)} className="block rounded-xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
                <div className="flex aspect-[3/4] items-end rounded-md bg-gradient-to-b from-[#7EB6F6] to-[#4894F3] p-3 text-sm font-semibold text-white">
                  {workspaceName}
                </div>
                <p className="mt-2 text-center text-sm">{workspaceName}</p>
              </Link>
            </li>
          </ul>
        ) : documents.length === 0 ? (
          <div data-testid="library-empty" className="mx-auto mt-10 max-w-md rounded-2xl bg-white px-6 py-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <p className="text-base font-medium">还没有文档</p>
            <p className="mt-2 text-sm text-[#8E8E93]">导入 PDF 或 EPUB 后，可以在这里阅读、摘录，并回到原文。</p>
          </div>
        ) : (
          <ul
            data-testid="library-list"
            className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4"
          >
            {documents.map((document) => {
              const pdf = document.mediaType !== "epub";
              return (
                <li key={document.id} className="relative">
                  <Link
                    data-testid="document-card"
                    href={studyPath(document.workspaceId, document.id)}
                    className="block rounded-xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                  >
                    <div
                      className={`relative aspect-[3/4] overflow-hidden rounded-md ${pdf ? "bg-gradient-to-b from-[#3CB58A] to-[#0E6B49]" : "bg-gradient-to-b from-[#4C5563] to-[#1C2430]"}`}
                    >
                      <span
                        data-testid="doc-badge"
                        className={`absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${pdf ? "bg-[#E5484D]" : "bg-[#7A5AF8]"}`}
                      >
                        {pdf ? "PDF" : "EPUB"}
                      </span>
                      {typeof document.meta?.pages === "number" ? (
                        <span className="absolute top-2 right-2 text-[11px] text-white/80">{document.meta.pages}</span>
                      ) : null}
                      <p className="absolute inset-x-3 bottom-4 text-center text-sm leading-snug font-semibold text-white">
                        {document.title}
                      </p>
                    </div>
                    <p className="mt-2 truncate text-center text-sm">{document.title}</p>
                  </Link>
                  <button
                    type="button"
                    data-testid="doc-menu"
                    aria-label={`${document.title} 更多`}
                    className="absolute right-4 bottom-3 grid size-8 place-items-center rounded-full text-sm text-[#8E8E93]"
                    onClick={(event) => {
                      event.preventDefault();
                      window.location.assign(studyPath(document.workspaceId, document.id));
                    }}
                  >
                    ···
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <nav
        data-testid="library-tabs"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#EFEFEF] bg-white md:hidden pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          aria-current={section === "docs" ? "page" : undefined}
          className={`inline-flex min-h-11 flex-1 items-center justify-center text-sm font-medium ${section === "docs" ? "text-[#2F6FEB]" : "text-[#67707D]"}`}
          onClick={() => setSection("docs")}
        >
          文档
        </button>
        <button
          type="button"
          aria-current={section === "sets" ? "page" : undefined}
          className={`inline-flex min-h-11 flex-1 items-center justify-center text-sm font-medium ${section === "sets" ? "text-[#2F6FEB]" : "text-[#67707D]"}`}
          onClick={() => setSection("sets")}
        >
          学习集
        </button>
        <Link
          href={reviewPath(workspaceId)}
          className="inline-flex min-h-11 flex-1 items-center justify-center text-sm font-medium text-[#67707D]"
        >
          复习
        </Link>
      </nav>
    </div>
  );
}
