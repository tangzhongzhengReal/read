import { NextRequest } from "next/server";
import { afterEach, expect, test } from "vitest";
import { SESSION_COOKIE, verifySession } from "@/src/lib/auth/session";
import { POST } from "./route";

const originalToken = process.env.READ_AUTH_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.READ_AUTH_TOKEN;
  else process.env.READ_AUTH_TOKEN = originalToken;
});

function login(token: string, url = "http://127.0.0.1/api/auth/login", proto?: string) {
  return POST(
    new NextRequest(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(proto ? { "x-forwarded-proto": proto } : {}),
      },
      body: JSON.stringify({ token }),
    }),
  );
}

test("the default token sets an HttpOnly session and a wrong token does not", async () => {
  delete process.env.READ_AUTH_TOKEN;

  const rejected = await login("not-the-token");
  expect(rejected.status).toBe(401);
  expect(rejected.headers.get("set-cookie")).toBeNull();

  const accepted = await login("marctang33");
  expect(accepted.status).toBe(200);
  const setCookie = accepted.headers.get("set-cookie") ?? "";
  expect(setCookie.toLowerCase()).toContain("httponly");
  expect(setCookie.toLowerCase()).not.toContain("secure");
  expect(setCookie).not.toContain("marctang33");

  const cookiePair = setCookie.split(";")[0] ?? "";
  const value = cookiePair.slice(cookiePair.indexOf("=") + 1);
  expect(cookiePair.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
  expect(verifySession(value, "marctang33")).toBe(true);
});

test("READ_AUTH_TOKEN overrides the default and https marks the cookie secure", async () => {
  process.env.READ_AUTH_TOKEN = "server-token";
  const wrongDefault = await login("marctang33");
  expect(wrongDefault.status).toBe(401);

  const accepted = await login("server-token", "http://127.0.0.1/api/auth/login", "https");
  expect(accepted.status).toBe(200);
  const setCookie = accepted.headers.get("set-cookie") ?? "";
  expect(setCookie.toLowerCase()).toContain("secure");
  const value = (setCookie.split(";")[0] ?? "").split("=").slice(1).join("=");
  expect(verifySession(value, "server-token")).toBe(true);
  expect(verifySession(value, "marctang33")).toBe(false);
});
