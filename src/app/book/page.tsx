import { Suspense } from "react";
import { BookFlow } from "./BookFlow";

export const metadata = { title: "จองห้อง" };

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600" />
        </div>
      }
    >
      <BookFlow />
    </Suspense>
  );
}
