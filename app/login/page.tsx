import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10">正在打开登录…</p>}>
      <LoginForm />
    </Suspense>
  );
}
