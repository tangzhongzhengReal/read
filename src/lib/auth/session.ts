import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "read_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

type SessionPayload = {
  exp: number;
  n: string;
};

export function tokensMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signSession(token: string, now = Date.now()): string {
  const payload: SessionPayload = {
    exp: now + SESSION_TTL_MS,
    n: randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", token).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(
  cookie: string | undefined,
  token: string,
  now = Date.now(),
): boolean {
  if (!cookie || !token) return false;
  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return false;
  const body = cookie.slice(0, dot);
  const signature = cookie.slice(dot + 1);
  if (signature.includes(".")) return false;
  const expected = createHmac("sha256", token).update(body).digest("base64url");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    return typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

export function requestIsSecure(request: {
  nextUrl: { protocol: string };
  headers: { get(name: string): string | null };
}): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return request.nextUrl.protocol === "https:";
}

export function sessionCookieOptions(secure: boolean): {
  name: string;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
