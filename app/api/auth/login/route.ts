import { NextRequest, NextResponse } from "next/server";
import {
  requestIsSecure,
  sessionCookieOptions,
  signSession,
  tokensMatch,
} from "@/src/lib/auth/session";
import { expectedAuthToken } from "@/src/lib/auth/token";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
  const provided =
    typeof body === "object" && body !== null && "token" in body && typeof body.token === "string"
      ? body.token
      : "";
  const expected = expectedAuthToken();
  if (!tokensMatch(provided, expected)) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...sessionCookieOptions(requestIsSecure(request)),
    value: signSession(expected),
  });
  return response;
}
