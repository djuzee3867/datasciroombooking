import { Suspense } from "react";
import { SignUpForm } from "./SignUpForm";

export const metadata = { title: "สมัครสมาชิก" };

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
