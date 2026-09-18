"use client";

/**
 * โครงหน้าสำหรับ "หน้าหลังบ้าน" — แยกออกจาก UI ผู้ใช้ทั่วไปตามแผน §9
 * ใช้ร่วมกันระหว่างหน้าผู้ดูแลห้อง (/manager) และหน้าแอดมิน (/admin)
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { hasRole } from "@/lib/repo";
import { ROLE_LABEL } from "@/lib/policy";
import type { Role } from "@/lib/types";
import { RoleSwitcher } from "./RoleSwitcher";
import { COPYRIGHT_YEAR, ORG } from "./SiteShell";
import { Badge, ButtonLink, EmptyState, cx } from "@/components/ui/primitives";
import { IconChevronLeft, IconLock } from "@/components/ui/icons";

export function ConsoleShell({
  title,
  subtitle,
  accent,
  tabs,
  activeTab,
  onTab,
  requiredRoles,
  children,
  headerRight,
}: {
  title: string;
  subtitle: string;
  accent: "manager" | "admin";
  tabs: { value: string; label: string; count?: number }[];
  activeTab: string;
  onTab: (v: string) => void;
  requiredRoles: Role[];
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  const { viewer } = useStore();
  const allowed = hasRole(viewer, ...requiredRoles);

  return (
    <div className="flex min-h-screen flex-col bg-ink-50/70">
      <header
        className={cx(
          "sticky top-0 z-40 border-b",
          accent === "admin"
            ? "border-brand-900/40 bg-brand-950"
            : "border-ink-800/40 bg-[#241b39]",
        )}
      >
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-medium text-white/85 ring-1 ring-inset ring-white/15 transition hover:bg-white/20"
            >
              <IconChevronLeft className="h-3.5 w-3.5" /> เว็บผู้ใช้
            </Link>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-bold text-white">
                {title}
                <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
                  {accent === "admin" ? "admin" : "room manager"}
                </span>
              </p>
              <p className="truncate text-[11px] text-white/55">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            <RoleSwitcher variant="onDark" />
          </div>
        </div>

        {allowed && (
          <div className="mx-auto max-w-[92rem] px-4 sm:px-6">
            <nav className="thin-scroll -mb-px flex gap-1 overflow-x-auto">
              {tabs.map((t) => {
                const active = t.value === activeTab;
                return (
                  <button
                    key={t.value}
                    onClick={() => onTab(t.value)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition",
                      active
                        ? "border-white text-white"
                        : "border-transparent text-white/55 hover:text-white/85",
                    )}
                  >
                    {t.label}
                    {t.count !== undefined && t.count > 0 && (
                      <span
                        className={cx(
                          "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          active ? "bg-white text-brand-800" : "bg-white/15 text-white/80",
                        )}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-6 sm:px-6">
        {allowed ? (
          children
        ) : (
          <div className="mx-auto max-w-xl py-16">
            <EmptyState
              icon={
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-ink-400 ring-1 ring-ink-200">
                  <IconLock className="h-5 w-5" />
                </span>
              }
              title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้"
              description={`หน้านี้เปิดให้เฉพาะ ${requiredRoles.map((r) => ROLE_LABEL[r]).join(" หรือ ")} — กดปุ่มบัญชีมุมขวาบนเพื่อสลับผู้ใช้ทดลอง`}
              action={<ButtonLink href="/">กลับหน้าแรก</ButtonLink>}
            />
            {viewer && (
              <p className="mt-4 text-center text-xs text-ink-400">
                ผู้ใช้ปัจจุบัน: {viewer.name} ·{" "}
                {viewer.roles.map((r) => (
                  <Badge key={r} className="ml-1 bg-white text-ink-600 ring-ink-200">{ROLE_LABEL[r]}</Badge>
                ))}
              </p>
            )}
          </div>
        )}
      </main>

      {/* หน้าหลังบ้านใช้ footer แบบบรรทัดเดียว จะได้ไม่แย่งพื้นที่ตาราง */}
      <footer className="border-t border-ink-100 bg-white/70 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-ink-400">
          <p>
            {ORG.name} · {ORG.faculty} · {ORG.address} · Tel. {ORG.tel} · Email : {ORG.email}
          </p>
          <p>© {COPYRIGHT_YEAR} {ORG.name}</p>
        </div>
      </footer>
    </div>
  );
}
