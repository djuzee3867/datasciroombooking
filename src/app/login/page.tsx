import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
