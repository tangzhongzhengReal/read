import { Suspense } from "react";
import { PdfReader } from "@/components/pdf-reader";

export default function ReadPage() {
  return (
    <Suspense fallback={<p className="px-6 py-10">正在打开文档…</p>}>
      <PdfReader />
    </Suspense>
  );
}
