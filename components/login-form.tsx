"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/src/lib/auth/paths";

export function LoginForm() {
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setError("令牌不正确");
        setPending(false);
        return;
      }
      window.location.assign(safeNextPath(params.get("next")));
    } catch {
      setError("无法登录");
      setPending(false);
    }
  }

  return (
    <div data-testid="login-page" className="min-h-svh bg-background text-foreground">
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground">Read</p>
          <h1 className="text-2xl font-semibold">登录</h1>
          <p className="mt-2 text-sm text-muted-foreground">输入访问令牌后继续阅读。</p>
        </div>
        <form data-testid="login-form" className="flex flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
          <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="auth-token">
            访问令牌
            <input
              id="auth-token"
              name="token"
              data-testid="auth-token"
              type="password"
              autoComplete="current-password"
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          {error ? (
            <p role="alert" data-testid="auth-error" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            data-testid="auth-submit"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={pending || token.length === 0}
          >
            进入
          </button>
        </form>
      </main>
    </div>
  );
}
