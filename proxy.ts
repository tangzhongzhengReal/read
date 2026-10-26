import type { NextRequest } from "next/server";
import { handleProxy } from "@/src/lib/auth/proxy-handler";

export function proxy(request: NextRequest) {
  return handleProxy(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|pdf\\.worker\\.min\\.mjs|standard_fonts(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|pfb|ttf|otf|woff2?)$).*)",
  ],
};
