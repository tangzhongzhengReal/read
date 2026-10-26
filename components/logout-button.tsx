"use client";

import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // The session cookie is gone; a full load drops the cached shell.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  return (
    <button
      type="button"
      data-testid="logout"
      className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
      disabled={pending}
      onClick={() => {
        void logout();
      }}
    >
      退出
    </button>
  );
}
