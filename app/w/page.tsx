import { Suspense } from "react";
import { StudyWorkspace } from "@/components/study/study-workspace";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<p className="bg-canvas px-6 py-10 text-sm text-[#8E8E93]">正在打开学习集…</p>}>
      <StudyWorkspace />
    </Suspense>
  );
}
