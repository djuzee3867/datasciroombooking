"use client";

/**
 * หน้าแรก (plan001.md §8.1)
 * บล็อกค้นหา → การ์ดห้อง
 * ทุกอย่างดูได้โดยไม่ต้องล็อกอิน และเห็นเฉพาะ slot + ชื่อเรื่องสาธารณะ (§11.1)
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { POLICY } from "@/lib/policy";
import { unitStatusAt } from "@/lib/conflicts";
import { holidayOn, listFloors, listUnits, scheduleForDay } from "@/lib/repo";
import { isWeekend, thaiDateLong, relativeDayLabel } from "@/lib/time";
import {
  Logo, NavPills, PrototypeBanner, SiteFooter,
} from "@/components/layout/SiteShell";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import {
  Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Select,
} from "@/components/ui/primitives";
import {
  IconBuilding, IconCalendarPlus, IconChart, IconLayers, IconSearch,
  IconSparkle,
} from "@/components/ui/icons";
import { RoomCard } from "@/components/RoomCard";
import { DateStrip } from "@/components/DatePickers";
import { CategoryLegend } from "@/components/schedule/TimelineBar";

export default function HomePage() {
  const { db, today, nowIso } = useStore();
  const buildings = db.buildings;
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const floors = listFloors(db, buildingId);
  const [floorId, setFloorId] = useState<string>("all");
  const [dateKey, setDateKey] = useState(today);
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState({ floorId: "all", dateKey: today, query: "" });
  const listRef = useRef<HTMLDivElement>(null);

  // หน้าแรกแสดงเฉพาะห้องที่จองได้ — ห้องที่จองไม่ได้ยังเห็นได้บนแผนผังชั้นเท่านั้น
  const results = useMemo(() => {
    const all = listUnits(db, {
      floorId: applied.floorId === "all" ? undefined : applied.floorId,
      bookableOnly: true,
    });
    const q = applied.query.trim().toLowerCase();
    return all.filter(
      (u) =>
        !q
        || u.code.toLowerCase().includes(q)
        || u.name.toLowerCase().includes(q)
        || u.roomType.toLowerCase().includes(q),
    );
  }, [db, applied]);

  const isToday = applied.dateKey === today;

  // นิยาม "ว่างตอนนี้" (§8.1) — ณ เวลาปัจจุบัน ไม่มี APPROVED/IN_USE ทับ และอยู่ในเวลาให้บริการ
  const freeNow = results.filter((u) => unitStatusAt(db, u.id, nowIso).status === "FREE").length;
  // วันในอนาคตใช้ป้าย "ว่างทั้งวัน" แทน
  const freeAllDay = results.filter((u) => scheduleForDay(db, u.id, applied.dateKey).length === 0).length;

  const holiday = holidayOn(db, applied.dateKey);
  const relative = relativeDayLabel(applied.dateKey, today);

  const search = () => {
    setApplied({ floorId, dateKey, query });
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PrototypeBanner />

      {/* ---------- Hero ---------- */}
      <div className="relative isolate overflow-hidden bg-ink-900">
        {/* รูปปกศูนย์วิจัยเต็มพื้นหลัง (แสดงสีจริง ไม่เคลือบโทนม่วง) */}
        <img
          src="/dsrc.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
        {/* ฉากมืดโทนกลาง (ไม่ใช่สีม่วง) พอให้ตัวอักษรสีขาวอ่านชัด — §11.2 WCAG */}
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/40 to-black/60"
          aria-hidden
        />

        <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo onDark />
          <RoleSwitcher variant="onDark" />
        </header>

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 text-center sm:px-6 sm:pb-28 sm:pt-14">
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            ระบบจองห้องสาขาวิทยาการข้อมูล
          </h1>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/book" size="lg" variant="inverse">
              <IconCalendarPlus className="h-5 w-5" /> เริ่มจองห้อง
            </ButtonLink>
            <ButtonLink href="/guide" size="lg" variant="outlineLight">
              อ่านคู่มือการใช้งาน
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* ---------- เมนูลอย ---------- */}
      {/* w-full กันไม่ให้กล่องนี้ (ซึ่งเป็น flex item ของ body) หดตาม min-content
          ของเมนูจนดันหน้าเลื่อนแนวนอนบนมือถือ — เมนูจะเลื่อนภายในตัวเองแทน */}
      <div className="mx-auto w-full -mt-9 max-w-4xl px-4 sm:px-6">
        <NavPills floating />
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 pb-4 pt-10 sm:px-6">
        {/* ---------- บล็อกค้นหา ---------- */}
        <Card className="scroll-mt-24">
          <CardHeader
            icon={<IconSearch className="h-4.5 w-4.5" />}
            title="ตารางการจองห้อง"
            subtitle="เลือกตึก ชั้น และวันที่ เพื่อดูห้องที่ว่างในวันนั้น"
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <IconBuilding className="h-3.5 w-3.5" /> ตึก
              </span>
              <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name.replace(/^อาคาร\s*\S+\s*—\s*/, "")}</option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <IconLayers className="h-3.5 w-3.5" /> ชั้น
              </span>
              <Select value={floorId} onChange={(e) => setFloorId(e.target.value)}>
                <option value="all">ทุกชั้น</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>ชั้น {f.floorNo} · {f.name}</option>
                ))}
              </Select>
            </label>

            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <Button size="lg" className="w-full lg:w-auto lg:px-8" onClick={search}>
                <IconSearch className="h-4 w-4" /> ค้นหาห้อง
              </Button>
            </div>
          </div>

          <div className="mt-3">
            <span className="mb-1.5 block text-xs font-medium text-ink-500">วันที่</span>
            <DateStrip value={dateKey} onChange={setDateKey} days={14} />
          </div>

          {/* บรรทัดสรุปผล */}
          <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <span className="font-semibold">พบ {results.length} ห้อง</span>
            <span className="text-brand-300">·</span>
            <span className="font-semibold text-emerald-700">
              {isToday ? `ว่างตอนนี้ ${freeNow} ห้อง` : `ว่างทั้งวัน ${freeAllDay} ห้อง`}
            </span>
            <span className="text-brand-300">·</span>
            <span>{buildings.find((b) => b.id === buildingId)?.code}</span>
            <span className="text-brand-300">·</span>
            <span>
              {thaiDateLong(applied.dateKey)}
              {relative && <span className="text-brand-500"> ({relative})</span>}
            </span>
            <span className="text-brand-300">·</span>
            <span>เวลาให้บริการ {POLICY.openTime}–{POLICY.closeTime} น.</span>

            {isWeekend(applied.dateKey) && (
              <Badge className="bg-white text-brand-700 ring-brand-200">วันหยุดสุดสัปดาห์ · จองได้ตามปกติ</Badge>
            )}
            {holiday && (
              <Badge className="bg-amber-50 text-amber-800 ring-amber-200" dot="bg-amber-500">
                {holiday.name} · จองได้ตามปกติ
              </Badge>
            )}
          </div>

          <p className="mt-2 text-xs leading-relaxed text-ink-400">
            ต้องการใช้ห้องนอกเวลา ติดต่อ ศูนย์วิจัยวิทยาการข้อมูล โทร 053-941986
          </p>
        </Card>

        {/* ---------- รายการห้อง ---------- */}
        <div ref={listRef} className="mt-10 scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink-900">ห้องที่จองได้</h2>
              <p className="mt-1 text-sm text-ink-500">
                แสดงเฉพาะห้องที่เปิดให้จอง · กด “ดูอีก 6 วันข้างหน้า” ในการ์ดเพื่อเทียบตารางหลายวันได้ทันที
              </p>
            </div>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setApplied((a) => ({ ...a, query: e.target.value }));
              }}
              placeholder="ค้นหาชื่อห้อง หรือรหัสห้อง…"
              aria-label="ค้นหาห้อง"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 sm:w-72"
            />
          </div>

          <div className="mb-4 rounded-xl border border-ink-100 bg-white px-4 py-3">
            <p className="mb-2 text-xs font-medium text-ink-500">คำอธิบายสีในตารางเวลา</p>
            <CategoryLegend compact />
          </div>

          {results.length === 0 ? (
            <EmptyState
              title="ไม่พบห้องที่ตรงกับเงื่อนไข"
              description={
                applied.floorId !== "all" && !applied.query.trim()
                  ? "ชั้นนี้ไม่มีห้องที่เปิดให้จองผ่านระบบ"
                  : "ลองเปลี่ยนชั้น หรือลบคำค้นหาออก"
              }
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setFloorId("all");
                    setApplied({ floorId: "all", dateKey, query: "" });
                  }}
                >
                  ล้างตัวกรอง
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {results.map((u) => (
                <RoomCard
                  key={u.id}
                  unit={u}
                  dateKey={applied.dateKey}
                />
              ))}
            </div>
          )}
        </div>

      </main>

      <SiteFooter />
    </>
  );
}
