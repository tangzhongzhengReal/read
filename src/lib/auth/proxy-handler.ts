import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/src/lib/auth/guard";
import { SESSION_COOKIE } from "@/src/lib/auth/session";
import { expectedAuthToken } from "@/src/lib/auth/token";

export function handleProxy(request: NextRequest) {
  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    sessionCookie: request.cookies.get(SESSION_COOKIE)?.value,
    token: expectedAuthToken(),
  });
  if (decision.kind === "allow") return NextResponse.next();
  if (decision.kind === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL(decision.href, request.url));
}
