export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return true;
  if (pathname === "/favicon.ico" || pathname === "/pdf.worker.min.mjs") return true;
  if (pathname === "/standard_fonts" || pathname.startsWith("/standard_fonts/")) return true;
  if (pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/image/")) return true;
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|pfb|ttf|otf|woff2?)$/i.test(pathname);
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.includes("\\") || value.includes("://")) return "/";
  const pathOnly = value.split("?")[0] ?? "";
  if (pathOnly === "/login" || pathOnly.startsWith("/login/")) return "/";
  return value;
}
