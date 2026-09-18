"use client";

/** โครงหน้าเข้าสู่ระบบ/สมัครสมาชิก — การ์ดกลางจอบนพื้นไล่สีขาว–ม่วง */

import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { ContactBlock, Logo, PrototypeBanner } from "@/components/layout/SiteShell";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50 to-white">
      <PrototypeBanner />
      <header className="px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Logo />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{subtitle}</p>
          </div>

          <Card className="p-5 sm:p-6">{children}</Card>

          {footer && <div className="mt-4 text-center text-sm text-ink-500">{footer}</div>}

          <p className="mt-6 text-center text-xs text-ink-400">
            <Link href="/" className="hover:text-brand-700">กลับหน้าแรก</Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:text-brand-700">นโยบายความเป็นส่วนตัว</Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-ink-100 bg-white/70 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <ContactBlock centered />
        </div>
      </footer>
    </div>
  );
}
