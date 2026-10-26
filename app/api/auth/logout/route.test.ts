import { NextRequest } from "next/server";
import { expect, test } from "vitest";
import { SESSION_COOKIE } from "@/src/lib/auth/session";
import { POST } from "./route";

test("logout clears the session cookie", async () => {
  const response = await POST(new NextRequest("http://127.0.0.1/api/auth/logout", { method: "POST" }));
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie") ?? "";
  expect(setCookie).toContain(`${SESSION_COOKIE}=`);
  expect(setCookie.toLowerCase()).toContain("httponly");
  expect(setCookie).toMatch(/Max-Age=0/i);
});
