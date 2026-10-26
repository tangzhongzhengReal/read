import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { afterEach, expect, test } from "vitest";
import { handleProxy } from "../src/lib/auth/proxy-handler";
import { SESSION_COOKIE, signSession } from "../src/lib/auth/session";

const originalToken = process.env.READ_AUTH_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.READ_AUTH_TOKEN;
  else process.env.READ_AUTH_TOKEN = originalToken;
});

test("proxy redirects pages, rejects APIs, and allows a signed session", async () => {
  delete process.env.READ_AUTH_TOKEN;
  const now = Date.now();
  const session = signSession("marctang33", now);

  const page = await handleProxy(new NextRequest("http://127.0.0.1/map?workspaceId=local"));
  expect(page.status).toBe(307);
  const location = page.headers.get("location") ?? "";
  expect(new URL(location).pathname).toBe("/login");
  expect(new URL(location).searchParams.get("next")).toBe("/map?workspaceId=local");

  const api = await handleProxy(new NextRequest("http://127.0.0.1/api/workspaces"));
  expect(api.status).toBe(401);
  expect(await api.json()).toEqual({ error: "unauthorized" });

  const login = await handleProxy(new NextRequest("http://127.0.0.1/login"));
  expect(login.status).toBe(200);
  expect(login.headers.get("location")).toBeNull();

  const allowed = await handleProxy(
    new NextRequest("http://127.0.0.1/", {
      headers: { cookie: `${SESSION_COOKIE}=${session}` },
    }),
  );
  expect(allowed.status).toBe(200);
  expect(allowed.headers.get("location")).toBeNull();
});

test("proxy matcher leaves Next static files and the self-hosted pdf worker alone", () => {
  const source = readFileSync("proxy.ts", "utf8");
  expect(source).toContain("_next/static");
  expect(source).toContain("pdf\\\\.worker\\\\.min\\\\.mjs");
  expect(source).toContain("standard_fonts");
});
