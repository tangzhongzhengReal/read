import { afterEach, describe, expect, test } from "vitest";
import {
  SESSION_COOKIE,
  requestIsSecure,
  sessionCookieOptions,
  signSession,
  tokensMatch,
  verifySession,
} from "./session";
import { DEFAULT_AUTH_TOKEN, expectedAuthToken } from "./token";

const originalToken = process.env.READ_AUTH_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.READ_AUTH_TOKEN;
  else process.env.READ_AUTH_TOKEN = originalToken;
});

test("the default token is marctang33 when the env var is unset or empty", () => {
  delete process.env.READ_AUTH_TOKEN;
  expect(expectedAuthToken()).toBe(DEFAULT_AUTH_TOKEN);
  expect(expectedAuthToken({ READ_AUTH_TOKEN: "" })).toBe("marctang33");
  expect(expectedAuthToken({ READ_AUTH_TOKEN: "other-secret" })).toBe("other-secret");
});

test("token comparison rejects mismatches and empty input", () => {
  expect(tokensMatch("marctang33", "marctang33")).toBe(true);
  expect(tokensMatch("marctang34", "marctang33")).toBe(false);
  expect(tokensMatch("", "marctang33")).toBe(false);
  expect(tokensMatch("marctang33", "marctang33-longer")).toBe(false);
});

test("a session cookie is signed, hides the raw token, and expires", () => {
  const now = Date.parse("2026-10-26T00:00:00Z");
  const cookie = signSession("marctang33", now);

  expect(cookie).not.toContain("marctang33");
  expect(verifySession(cookie, "marctang33", now + 1000)).toBe(true);
  expect(verifySession(cookie, "other-secret", now + 1000)).toBe(false);
  expect(verifySession(`${cookie}x`, "marctang33", now + 1000)).toBe(false);
  expect(verifySession(cookie, "marctang33", now + 31 * 24 * 60 * 60 * 1000)).toBe(false);
  expect(verifySession(undefined, "marctang33", now)).toBe(false);
});

describe("session cookie flags", () => {
  test("http login stays usable and https is marked secure", () => {
    expect(
      requestIsSecure({
        nextUrl: { protocol: "http:" },
        headers: { get: () => null },
      }),
    ).toBe(false);
    expect(
      requestIsSecure({
        nextUrl: { protocol: "http:" },
        headers: { get: (name) => (name === "x-forwarded-proto" ? "https" : null) },
      }),
    ).toBe(true);

    const options = sessionCookieOptions(true);
    expect(options).toMatchObject({
      name: SESSION_COOKIE,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  });
});
