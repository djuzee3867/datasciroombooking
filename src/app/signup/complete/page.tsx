import { Suspense } from "react";
import { CompleteProfileForm } from "./CompleteProfileForm";

export const metadata = { title: "กรอกข้อมูลให้ครบ" };

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
        </div>
      }
    >
      <CompleteProfileForm />
    </Suspense>
  );
}
