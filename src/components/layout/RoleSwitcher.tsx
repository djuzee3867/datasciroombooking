"use client";

/**
 * เมนูบัญชีผู้ใช้ (plan001.md §5)
 *
 * ยังไม่ล็อกอิน → ปุ่ม "เข้าสู่ระบบ" พาไป /login พร้อมจำหน้าที่กำลังดูอยู่
 * ล็อกอินแล้ว   → ชื่อผู้ใช้ สิทธิ์ ทางลัดไปหน้าที่ตนมีสิทธิ์ และปุ่มออกจากระบบ
 *
 * ตัวตนมาจากคุกกี้เซสชันฝั่งเซิร์ฟเวอร์ทั้งหมด หน้าจอนี้ทำได้แค่ "แสดง" กับ "ออกจากระบบ"
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/policy";
import { Badge, Button, ButtonLink, cx } from "@/components/ui/primitives";
import {
  IconChevronDown, IconList, IconLock, IconRefresh, IconShield,
} from "@/components/ui/icons";

const HIGHEST: Record<string, number> = {
  SUPER_ADMIN: 5, ADMIN: 4, USER: 2, GUEST: 1, VIEWER: 0,
};

export function RoleSwitcher({ variant = "light" }: { variant?: "light" | "onDark" }) {
  const { viewer, auth, logout, reset, pending } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const roles = viewer?.roles ?? [];
  const topRole = roles.length
    ? [...roles].sort((a, b) => HIGHEST[b] - HIGHEST[a])[0]
    : "VIEWER";
  const isAdmin = roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");

  if (!viewer) {
    return (
      <ButtonLink
        href={`/login?next=${encodeURIComponent(pathname || "/")}`}
        variant={variant === "onDark" ? "inverse" : "primary"}
        size="md"
      >
        <IconLock className="h-4 w-4" /> เข้าสู่ระบบ
      </ButtonLink>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx(
          "flex h-10 items-center gap-2 rounded-xl pl-2 pr-3 text-sm font-medium transition",
          variant === "onDark"
            ? "bg-white/12 text-white ring-1 ring-inset ring-white/25 backdrop-blur hover:bg-white/20"
            : "border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50",
        )}
      >
        <span
          className={cx(
            "grid h-6 w-6 place-items-center rounded-lg text-[11px] font-bold",
            variant === "onDark" ? "bg-white/25 text-white" : "bg-brand-100 text-brand-700",
          )}
          aria-hidden
        >
          {viewer.name.trim().charAt(0)}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{viewer.name}</span>
        <span className="sm:hidden">บัญชี</span>
        <IconChevronDown className={cx("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-rise absolute right-0 z-50 mt-2 w-[19rem] overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-xl shadow-ink-900/10"
        >
          <div className="border-b border-ink-100 bg-brand-50/70 px-4 py-3">
            <p className="truncate font-semibold text-ink-900">{viewer.name}</p>
            <p className="truncate text-xs text-ink-500">{viewer.email}</p>
            <p className="mt-2 flex flex-wrap gap-1">
              {roles.map((r) => (
                <Badge key={r} className="bg-white text-ink-600 ring-ink-200">{ROLE_LABEL[r]}</Badge>
              ))}
            </p>
            {!auth.profileComplete && (
              <Link
                href="/signup/complete"
                onClick={() => setOpen(false)}
                className="mt-2 block text-xs font-medium text-amber-700 hover:underline"
              >
                ข้อมูลติดต่อยังไม่ครบ — กรอกให้เสร็จก่อนจองห้อง
              </Link>
            )}
          </div>

          <div className="py-1">
            <Link
              href="/my-bookings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
            >
              <IconList className="h-4 w-4 text-ink-400" /> การจองของฉัน
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                <IconShield className="h-4 w-4" /> หน้าแอดมิน
              </Link>
            )}
          </div>

          {isAdmin && (
            <div className="border-t border-ink-100 p-2">
              {confirmReset ? (
                <div className="rounded-lg bg-rose-50 p-2.5">
                  <p className="mb-2 text-xs leading-relaxed text-rose-900">
                    จะลบรายการจองทั้งหมดในฐานข้อมูล แล้วใส่ข้อมูลตัวอย่างชุดใหม่ — กู้คืนไม่ได้
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={pending}
                      onClick={async () => {
                        await reset();
                        setConfirmReset(false);
                        setOpen(false);
                      }}
                    >
                      {pending ? "กำลังรีเซ็ต…" : "ยืนยันรีเซ็ต"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setConfirmReset(true)}
                >
                  <IconRefresh className="h-4 w-4" /> รีเซ็ตข้อมูลตัวอย่างในฐานข้อมูล
                </Button>
              )}
            </div>
          )}

          <div className="border-t border-ink-100 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-rose-600 hover:bg-rose-50"
              disabled={pending}
              onClick={async () => { setOpen(false); await logout(); }}
            >
              <IconLock className="h-4 w-4" /> ออกจากระบบ
            </Button>
          </div>

          <p className="border-t border-ink-100 bg-ink-50/60 px-4 py-2 text-[11px] text-ink-400">
            สิทธิ์สูงสุดของคุณ: {ROLE_LABEL[topRole as keyof typeof ROLE_LABEL]}
          </p>
        </div>
      )}
    </div>
  );
}
