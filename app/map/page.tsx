import { Suspense } from "react";
import { MindMap } from "@/components/mind-map";

export default function MapPage() {
  return (
    <Suspense fallback={<p className="px-6 py-10">正在打开脑图…</p>}>
      <MindMap />
    </Suspense>
  );
}
