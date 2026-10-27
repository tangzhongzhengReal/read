import { Suspense } from "react";
import { StudyWorkspace } from "@/components/study/study-workspace";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) return <p className="px-6 py-10">缺少学习集。</p>;
  return (
    <Suspense fallback={<p className="bg-canvas px-6 py-10 text-sm text-[#8E8E93]">正在打开学习集…</p>}>
      <StudyWorkspace workspaceId={id} />
    </Suspense>
  );
}
