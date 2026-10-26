import { expect, test } from "vitest";
import { decideAccess } from "./guard";
import { signSession } from "./session";
import { safeNextPath } from "./paths";

const now = Date.parse("2026-10-26T00:00:00Z");
const token = "marctang33";
const cookie = signSession(token, now);

test("pages without a session redirect to login and APIs return 401", () => {
  expect(decideAccess({ pathname: "/", search: "", sessionCookie: undefined, token, now })).toEqual({
    kind: "redirect",
    href: `/login?next=${encodeURIComponent("/")}`,
  });
  expect(
    decideAccess({
      pathname: "/map",
      search: "?workspaceId=local",
      sessionCookie: undefined,
      token,
      now,
    }),
  ).toEqual({
    kind: "redirect",
    href: `/login?next=${encodeURIComponent("/map?workspaceId=local")}`,
  });
  expect(
    decideAccess({ pathname: "/api/workspaces", search: "", sessionCookie: undefined, token, now }),
  ).toEqual({ kind: "unauthorized" });
});

test("login and static assets stay public, and a valid session opens the app", () => {
  expect(decideAccess({ pathname: "/login", search: "", sessionCookie: undefined, token, now })).toEqual({
    kind: "allow",
  });
  expect(
    decideAccess({ pathname: "/api/auth/login", search: "", sessionCookie: undefined, token, now }),
  ).toEqual({ kind: "allow" });
  expect(
    decideAccess({
      pathname: "/pdf.worker.min.mjs",
      search: "",
      sessionCookie: undefined,
      token,
      now,
    }),
  ).toEqual({ kind: "allow" });
  expect(
    decideAccess({
      pathname: "/standard_fonts/LiberationSans-Regular.ttf",
      search: "",
      sessionCookie: undefined,
      token,
      now,
    }),
  ).toEqual({ kind: "allow" });
  expect(decideAccess({ pathname: "/review", search: "", sessionCookie: cookie, token, now })).toEqual({
    kind: "allow",
  });
  expect(
    decideAccess({ pathname: "/api/documents", search: "", sessionCookie: cookie, token, now }),
  ).toEqual({ kind: "allow" });
});

test("a signed-in visit to login returns to a safe next path", () => {
  const read = decideAccess({
    pathname: "/login",
    search: "?next=/read",
    sessionCookie: cookie,
    token,
    now,
  });
  const external = decideAccess({
    pathname: "/login",
    search: "?next=https://evil.example",
    sessionCookie: cookie,
    token,
    now,
  });
  expect(read).toEqual({ kind: "redirect", href: "/read" });
  expect(external).toEqual({ kind: "redirect", href: "/" });
  expect(safeNextPath("//evil.example")).toBe("/");
  expect(safeNextPath("/login?next=/map")).toBe("/");
});
