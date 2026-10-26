import { isPublicPath, safeNextPath } from "@/src/lib/auth/paths";
import { verifySession } from "@/src/lib/auth/session";
import { expectedAuthToken } from "@/src/lib/auth/token";

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "unauthorized" }
  | { kind: "redirect"; href: string };

export function decideAccess(input: {
  pathname: string;
  search: string;
  sessionCookie: string | undefined;
  token?: string;
  now?: number;
}): AccessDecision {
  const token = input.token ?? expectedAuthToken();
  const authed = verifySession(input.sessionCookie, token, input.now);
  if (input.pathname === "/login" || input.pathname.startsWith("/login/")) {
    if (!authed) return { kind: "allow" };
    const next = new URL(input.pathname + input.search, "http://read.local").searchParams.get("next");
    return { kind: "redirect", href: safeNextPath(next) };
  }
  if (isPublicPath(input.pathname) || authed) return { kind: "allow" };
  if (input.pathname === "/api" || input.pathname.startsWith("/api/")) {
    return { kind: "unauthorized" };
  }
  const next = safeNextPath(`${input.pathname}${input.search}`);
  return { kind: "redirect", href: `/login?next=${encodeURIComponent(next)}` };
}
