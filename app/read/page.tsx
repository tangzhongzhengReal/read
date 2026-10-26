import { Suspense } from "react";
import { DocumentReader } from "@/components/document-reader";

export default function ReadPage() {
  return (
    <Suspense fallback={<p className="px-6 py-10">正在打开文档…</p>}>
      <DocumentReader />
    </Suspense>
  );
}
