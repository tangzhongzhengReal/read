import { Suspense } from "react";
import { ReviewQueue } from "@/components/review-queue";

export default function ReviewPage() {
  return (
    <Suspense fallback={<p className="px-6 py-10">正在打开复习…</p>}>
      <ReviewQueue />
    </Suspense>
  );
}
