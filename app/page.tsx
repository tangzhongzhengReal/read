import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <Suspense fallback={<p className="px-6 py-10">正在打开文库…</p>}>
      <AppShell />
    </Suspense>
  );
}
