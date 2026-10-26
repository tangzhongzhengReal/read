import { NextRequest, NextResponse } from "next/server";
import { requestIsSecure, sessionCookieOptions } from "@/src/lib/auth/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...sessionCookieOptions(requestIsSecure(request)),
    value: "",
    maxAge: 0,
  });
  return response;
}
