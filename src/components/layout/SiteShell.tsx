"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { cx } from "@/components/ui/primitives";
import { RoleSwitcher } from "./RoleSwitcher";
import {
  IconBook, IconCalendarPlus, IconChart, IconHome, IconList,
} from "@/components/ui/icons";

const NAV = [
  { href: "/", label: "หน้าแรก", Icon: IconHome },
  { href: "/book", label: "จองห้อง", Icon: IconCalendarPlus },
  { href: "/stats", label: "สถิติการใช้งาน", Icon: IconChart },
  { href: "/guide", label: "คู่มือการใช้งาน", Icon: IconBook },
] as const;

/**
 * ข้อมูลหน่วยงานเจ้าของระบบ — ใช้ทั้ง footer ของเว็บผู้ใช้และท้ายหน้าคอนโซล
 * เก็บไว้ที่เดียวจะได้ไม่ต้องไล่แก้หลายจุดเมื่อเบอร์หรืออีเมลเปลี่ยน
 */
export const ORG = {
  name: "DATA SCIENCE RESEARCH CENTER",
  faculty: "Faculty of Science, Chiang Mai University",
  address: "239 Huaykaew Road, Suthep, Muang, Chiang Mai 50200 THAILAND",
  tel: "053-941986",
  email: "ds.sci.cmu@gmail.com",
} as const;

/** ปี พ.ศ. ของลิขสิทธิ์ */
export const COPYRIGHT_YEAR = 2569;

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span
        className={cx(
          "grid h-9 w-9 place-items-center rounded-xl text-sm font-bold",
          onDark ? "bg-white/95 text-brand-700" : "bg-brand-600 text-white",
        )}
        aria-hidden
      >
        DS
      </span>
      <span className="leading-tight">
        <span className={cx("block text-sm font-bold", onDark ? "text-white" : "text-ink-900")}>
          DataSci Room Booking
        </span>
        <span className={cx("block text-[11px]", onDark ? "text-white/70" : "text-ink-400")}>
          คณะวิทยาศาสตร์สาขาวิทยาการข้อมูล
        </span>
      </span>
    </Link>
  );
}

/** แถบเมนูลอย — ดีไซน์ใหม่ ไม่ลอกหน้าเดิม แต่ยังคุ้นเคยกับผู้ใช้ (§8.1) */
export function NavPills({ floating = false }: { floating?: boolean }) {
  const pathname = usePathname();
  const { viewer } = useStore();

  const items = [
    ...NAV,
    ...(viewer ? [{ href: "/my-bookings", label: "การจองของฉัน", Icon: IconList } as const] : []),
  ];

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cx(
        "thin-scroll flex gap-1 overflow-x-auto",
        floating
          ? "rounded-2xl border border-ink-100 bg-white/95 p-1.5 shadow-[0_18px_40px_-24px_rgba(27,22,38,.55)] backdrop-blur"
          : "",
      )}
    >
      {items.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                : "text-ink-500 hover:bg-brand-50 hover:text-brand-700",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header
      className={cx(
        "sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur-md",
        compact ? "" : "",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <div className="hidden lg:block">
          <NavPills />
        </div>
        <RoleSwitcher />
      </div>
      <div className="border-t border-ink-100 px-4 py-2 lg:hidden">
        <NavPills />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-100 bg-ink-50/60">
      {/* จัดกึ่งกลางโดยให้ชื่อศูนย์วิจัยเป็นตัวหลักของ footer */}
      <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6">
        <ContactBlock centered />
        <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-500">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="hover:text-brand-700">{n.label}</Link>
            </li>
          ))}
          <li><Link href="/privacy" className="hover:text-brand-700">นโยบายความเป็นส่วนตัว</Link></li>
        </ul>
      </div>
      <div className="border-t border-ink-100 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 text-center text-xs text-ink-400">
          <p>© {COPYRIGHT_YEAR} {ORG.name}</p>
          {/* คำเตือนว่าเป็นระบบทดลอง — §14 ความเสี่ยงข้อ 1 */}
          <p>ระบบอยู่ระหว่างการพัฒนา · ข้อมูลทั้งหมดเป็นข้อมูลจำลองสำหรับทดสอบ</p>
        </div>
      </div>
    </footer>
  );
}

/** ที่อยู่และช่องทางติดต่อของศูนย์วิจัย — ใช้ซ้ำได้ทั้งใน footer และที่อื่น */
export function ContactBlock({ centered = false }: { centered?: boolean }) {
  return (
    <div className={cx(centered && "text-center")}>
      <p className="text-sm font-semibold tracking-wide text-ink-900">{ORG.name}</p>
      <address className="mt-2 space-y-1 text-sm not-italic leading-relaxed text-ink-500">
        <p>{ORG.faculty}</p>
        <p>{ORG.address}</p>
        <p className={cx("flex flex-wrap gap-x-4 gap-y-1", centered && "justify-center")}>
          <span>
            Tel.{" "}
            <a href={`tel:${ORG.tel.replace(/-/g, "")}`} className="hover:text-brand-700">
              {ORG.tel}
            </a>
          </span>
          <span>
            Email :{" "}
            <a href={`mailto:${ORG.email}`} className="break-all hover:text-brand-700">
              {ORG.email}
            </a>
          </span>
        </p>
      </address>
    </div>
  );
}

/** แถบเตือนว่านี่คือระบบทดลอง — §14 ความเสี่ยงข้อ 1 */
export function PrototypeBanner() {
  return (
    <div className="bg-brand-950 px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-brand-100 sm:px-6">
      ระบบทดลอง (prototype) · ข้อมูลเป็นข้อมูลจำลองบนฐานข้อมูลสำหรับทดสอบ และยังไม่ใช่การจองจริง
    </div>
  );
}

export function PageShell({
  children,
  header = true,
}: {
  children: ReactNode;
  header?: boolean;
}) {
  return (
    <>
      <PrototypeBanner />
      {header && <SiteHeader />}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-ink-100 bg-gradient-to-b from-brand-50/80 to-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          {eyebrow && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
