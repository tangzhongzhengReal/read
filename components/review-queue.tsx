"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { PresentedReview } from "@/src/lib/review/schedule";
import { libraryPath, LOCAL_WORKSPACE_ID, mapPath } from "@/src/lib/workspace";

type ReviewNode = {
  id: string;
  type: "excerpt" | "note" | "code";
  payload: { text?: string };
};

export function ReviewQueue() {
  const params = useSearchParams();
  const workspaceId = params.get("workspaceId") || LOCAL_WORKSPACE_ID;
  const [reviews, setReviews] = useState<PresentedReview[]>([]);
  const [nodes, setNodes] = useState<ReviewNode[]>([]);
  const [noteText, setNoteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReviews(workspaceId)
      .then((body) => {
        if (cancelled) return;
        setReviews(body.reviews);
        setNodes(body.nodes);
      })
      .catch(() => {
        if (!cancelled) setError("无法打开复习。");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setError(null);
    const nodeResponse = await fetch("/api/nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        type: "note",
        payload: { text },
      }),
    });
    if (!nodeResponse.ok) {
      setError("无法新建笔记。");
      return;
    }
    const nodeBody = (await nodeResponse.json()) as { node: ReviewNode };
    const review = await createReview(workspaceId, nodeBody.node.id);
    if (!review) {
      setError("无法加入复习。");
      return;
    }
    setNodes((current) => [...current, nodeBody.node]);
    setReviews((current) => upsertReview(current, review));
    setNoteText("");
  }

  async function addExisting(nodeId: string) {
    setError(null);
    const review = await createReview(workspaceId, nodeId);
    if (!review) {
      setError("无法加入复习。");
      return;
    }
    setReviews((current) => upsertReview(current, review));
  }

  async function markReviewed(id: string) {
    setPendingId(id);
    setError(null);
    const response = await fetch(`/api/reviews/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, reviewed: true }),
    });
    setPendingId(null);
    if (!response.ok) {
      setError("无法记下复习。");
      return;
    }
    const body = (await response.json()) as { review: PresentedReview };
    setReviews((current) => upsertReview(current, body.review));
  }

  const today = reviews.filter((review) => review.due);
  const later = reviews.filter((review) => !review.due);
  const reviewedIds = new Set(reviews.map((review) => review.nodeId));
  const candidates = nodes.filter(
    (node) => (node.type === "excerpt" || node.type === "note") && !reviewedIds.has(node.id),
  );

  return (
    <div data-testid="review-page" className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground">今日复习</p>
            <h1 className="text-xl leading-none font-semibold">Read</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link className="underline" href={mapPath(workspaceId)}>
              脑图
            </Link>
            <Link className="underline" href={libraryPath(workspaceId)}>
              返回文库
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => void addNote(event)}>
          <input
            data-testid="review-note-text"
            className="min-w-48 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={noteText}
            placeholder="写一条要复习的笔记"
            onChange={(event) => setNoteText(event.target.value)}
          />
          <button
            type="submit"
            data-testid="add-review-item"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            加入今日复习
          </button>
        </form>
        <section data-testid="today-review" className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">今天</h2>
          {today.length === 0 ? (
            <p className="text-sm text-muted-foreground">今天没有到期的复习。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {today.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  pending={pendingId === review.id}
                  onCheck={() => void markReviewed(review.id)}
                />
              ))}
            </ul>
          )}
        </section>
        <section data-testid="later-review" className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">已复习</h2>
          {later.length === 0 ? (
            <p className="text-sm text-muted-foreground">勾选后会记在这里，并给出下次复习日期。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {later.map((review) => (
                <ReviewRow key={review.id} review={review} pending={false} onCheck={() => {}} />
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">可加入复习</h2>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">摘录和笔记会出现在这里。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {candidates.map((node) => (
                <li
                  key={node.id}
                  data-testid="review-candidate"
                  className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10"
                >
                  <p className="whitespace-pre-wrap">{node.payload.text}</p>
                  <button
                    type="button"
                    data-testid="add-to-review"
                    className="shrink-0 rounded-lg border border-border px-2 py-1"
                    onClick={() => void addExisting(node.id)}
                  >
                    加入复习
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function ReviewRow({
  review,
  pending,
  onCheck,
}: {
  review: PresentedReview;
  pending: boolean;
  onCheck: () => void;
}) {
  return (
    <li
      data-testid="review-item"
      data-due={review.due ? "true" : "false"}
      className="flex items-start gap-3 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10"
    >
      <input
        type="checkbox"
        data-testid="review-check"
        className="mt-1"
        checked={!review.due}
        disabled={!review.due}
        onChange={() => {
          if (review.due && !pending) onCheck();
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap">{review.text}</p>
        {review.due ? (
          <p className="text-xs text-muted-foreground">今天</p>
        ) : (
          <p data-testid="next-review" className="text-xs text-muted-foreground">
            下次复习 {review.dueAt.slice(0, 10)}
          </p>
        )}
      </div>
    </li>
  );
}

async function loadReviews(workspaceId: string): Promise<{
  reviews: PresentedReview[];
  nodes: ReviewNode[];
}> {
  const [reviewResponse, nodeResponse] = await Promise.all([
    fetch(`/api/reviews?workspaceId=${encodeURIComponent(workspaceId)}`),
    fetch(`/api/nodes?workspaceId=${encodeURIComponent(workspaceId)}`),
  ]);
  if (!reviewResponse.ok || !nodeResponse.ok) throw new Error("无法打开复习");
  const reviewBody = (await reviewResponse.json()) as { reviews: PresentedReview[] };
  const nodeBody = (await nodeResponse.json()) as { nodes: ReviewNode[] };
  return { reviews: reviewBody.reviews, nodes: nodeBody.nodes };
}

async function createReview(workspaceId: string, nodeId: string): Promise<PresentedReview | null> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId, nodeId }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { review: PresentedReview };
  return body.review;
}

function upsertReview(current: PresentedReview[], review: PresentedReview): PresentedReview[] {
  const index = current.findIndex((item) => item.id === review.id);
  if (index === -1) return [...current, review];
  const next = [...current];
  next[index] = review;
  return next;
}
