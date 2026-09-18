"use client";

/**
 * หน้ารายละเอียดห้อง (plan001.md §8.2) — อ้างอิง pic/detail1.png
 * ผู้ที่ไม่มีสิทธิ์เห็นเฉพาะ "ช่วงเวลา + ชื่อเรื่องสาธารณะ" เท่านั้น (§11.1)
 */

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { POLICY } from "@/lib/policy";
import { bookingHoursOf, displayHours, unitStatusAt } from "@/lib/conflicts";
import {
  canSeeBookingDetails, equipmentOf, getUnitByCode, listUnits,
  scheduleForDay, scheduleForRange,
} from "@/lib/repo";
import {
  addDays, durationLabel, hhmmOf, thaiDateLong, thaiDateMedium,
} from "@/lib/time";
import { PageShell } from "@/components/layout/SiteShell";
import {
  Badge, ButtonLink, Card, CardHeader, EmptyState, cx,
} from "@/components/ui/primitives";
import {
  EquipmentIcon, IconBan, IconChevronLeft, IconChevronRight, IconClock,
  IconShield, IconUsers,
} from "@/components/ui/icons";
import { RoomGallery } from "@/components/RoomPhoto";
import { DayColumnsGrid } from "@/components/schedule/DayColumnsGrid";
import { CategoryLegend } from "@/components/schedule/TimelineBar";

const DAYS_BACK = 2;
const DAYS_TOTAL = 6; // ย้อนหลัง 2 + วันที่เลือก + ล่วงหน้า 3

export function RoomDetail({ code }: { code: string }) {
  const { db, today, nowIso, viewer } = useStore();
  const unit = getUnitByCode(db, code);
  const [anchor, setAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);

  const hours = bookingHoursOf(unit);
  // ไม่ใช้ useMemo — React Compiler จัดการให้เอง และ memo เองทำให้ optimize ไม่ผ่าน
  const days = unit
    ? scheduleForRange(db, unit.id, addDays(anchor, -DAYS_BACK), DAYS_TOTAL)
    : [];

  // ขยายกรอบตารางให้ครอบคลุมรายการนอกเวลา ไม่งั้นแท่งจะหลุดออกนอกกรอบจนมองไม่เห็น
  const gridHours = displayHours(hours, days.flatMap((d) => d.entries));

  if (!unit) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <EmptyState
            title={`ไม่พบห้องรหัส ${code}`}
            description="ห้องนี้อาจถูกปิดใช้งาน หรือรหัสห้องไม่ถูกต้อง"
            action={<ButtonLink href="/">กลับหน้าแรก</ButtonLink>}
          />
        </div>
      </PageShell>
    );
  }

  const floor = db.floors.find((f) => f.id === unit.floorId)!;
  const equipment = equipmentOf(db, unit);
  const live = unitStatusAt(db, unit.id, nowIso);
  const dayEntries = scheduleForDay(db, unit.id, selectedDay);
  const siblings = listUnits(db, { floorId: unit.floorId }).filter((u) => u.id !== unit.id);
  const usedMinutes = dayEntries.reduce(
    (s, e) => s + (new Date(e.endAt).getTime() - new Date(e.startAt).getTime()) / 60000,
    0,
  );

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="เส้นทาง" className="mb-4 flex items-center gap-1.5 text-xs text-ink-400">
          <Link href="/" className="hover:text-brand-700">หน้าแรก</Link>
          <span>/</span>
          <span>{floor.name}</span>
          <span>/</span>
          <span className="text-ink-700">{unit.code}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/"
              className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              <IconChevronLeft className="h-3.5 w-3.5" /> กลับไปตารางการจอง
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              {unit.name} <span className="text-ink-400">{unit.code}</span>
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              อาคาร SCB4 · ชั้น {floor.floorNo} · {unit.roomType}
              {unit.capacity > 0 && ` · ${unit.capacity} ที่นั่ง`} · เวลาให้บริการ {hours.open}–{hours.close} น.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {live.status === "FREE" && (
              <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200" dot="bg-emerald-500">ว่างตอนนี้</Badge>
            )}
            {live.status === "BUSY" && (
              <Badge className="bg-rose-50 text-rose-700 ring-rose-200" dot="bg-rose-500">
                ไม่ว่างถึง {hhmmOf(live.until!)}
              </Badge>
            )}
            {live.status === "CLOSED" && (
              <Badge className="bg-ink-50 text-ink-500 ring-ink-200" dot="bg-ink-300">นอกเวลาให้บริการ</Badge>
            )}
            {unit.isBookable ? (
              <ButtonLink href={`/book?unit=${unit.code}`} size="lg">จองห้องนี้</ButtonLink>
            ) : (
              <Badge className="bg-ink-100 text-ink-500 ring-ink-200" dot="bg-ink-400">ไม่เปิดให้จอง</Badge>
            )}
          </div>
        </div>

        {!unit.isBookable && unit.unbookableReason && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
            <IconBan className="mt-0.5 h-4 w-4 shrink-0" />
            {unit.unbookableReason}
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* ---------- คอลัมน์ซ้าย ---------- */}
          <div className="space-y-5">
            <Card padded={false} className="p-4 sm:p-5">
              <RoomGallery images={unit.images} code={unit.code} />
              <p className="mt-4 text-sm leading-relaxed text-ink-600">{unit.description}</p>
            </Card>

            <Card>
              <CardHeader
                title="ตารางจองห้อง"
                subtitle={`ย้อนหลัง ${DAYS_BACK} วัน และล่วงหน้า ${DAYS_TOTAL - DAYS_BACK - 1} วัน · กดที่หัวคอลัมน์เพื่อดูรายการของวันนั้น`}
                action={
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setAnchor(addDays(anchor, -3))}
                      aria-label="เลื่อนย้อนหลัง"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 text-ink-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <IconChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setAnchor(today); setSelectedDay(today); }}
                      className="h-9 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      วันนี้
                    </button>
                    <button
                      onClick={() => setAnchor(addDays(anchor, 3))}
                      aria-label="เลื่อนไปข้างหน้า"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 text-ink-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <IconChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                }
              />
              <DayColumnsGrid
                days={days}
                hours={gridHours}
                today={today}
                selected={selectedDay}
                onSelectDay={setSelectedDay}
              />
              <div className="mt-4 border-t border-ink-100 pt-3">
                <CategoryLegend compact />
              </div>
            </Card>

            <Card>
              <CardHeader
                title={`รายการวันที่เลือก · ${thaiDateLong(selectedDay)}`}
                subtitle={
                  dayEntries.length
                    ? `ใช้ไปแล้ว ${Math.round(usedMinutes / 6) / 10} ชม. จากเวลาให้บริการทั้งหมด`
                    : undefined
                }
              />
              {dayEntries.length === 0 ? (
                <EmptyState
                  title="ยังไม่มีรายการจองในวันนี้"
                  description={unit.isBookable ? "ห้องว่างตลอดเวลาให้บริการ" : undefined}
                  action={
                    unit.isBookable
                      ? <ButtonLink href={`/book?unit=${unit.code}`} size="sm">จองห้องนี้</ButtonLink>
                      : undefined
                  }
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {dayEntries.map((e) => {
                    const booking = db.bookings.find((b) => b.id === e.bookingId);
                    const canSee = booking ? canSeeBookingDetails(db, viewer, booking) : false;
                    return (
                      <li key={e.id} className="flex flex-wrap items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                        <span className="w-28 shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                          {hhmmOf(e.startAt)}–{hhmmOf(e.endAt)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink-900">{e.publicTitle}</p>
                          <p className="mt-0.5 text-xs text-ink-400">
                            {durationLabel(e.startAt, e.endAt)}
                            {e.kind === "BLACKOUT" && " · ปิดใช้งานชั่วคราว"}
                          </p>
                          {canSee && booking && (
                            <p className="mt-1.5 text-xs text-ink-500">
                              ผู้จอง: {db.users.find((u) => u.id === booking.ownerId)?.name} ·
                              {" "}{booking.attendeeCount} คน · {booking.purpose}
                            </p>
                          )}
                        </div>
                        <Badge
                          className={
                            e.status === "PENDING"
                              ? "bg-amber-50 text-amber-800 ring-amber-200"
                              : e.status === "BLOCKED"
                                ? "bg-ink-100 text-ink-600 ring-ink-200"
                                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          }
                          dot={
                            e.status === "PENDING" ? "bg-amber-500"
                              : e.status === "BLOCKED" ? "bg-ink-400" : "bg-emerald-500"
                          }
                        >
                          {e.status === "PENDING" ? "รออนุมัติ"
                            : e.status === "BLOCKED" ? "ปิดปรับปรุง" : "อนุมัติแล้ว"}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!viewer && dayEntries.length > 0 && (
                <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-400">
                  ผู้ที่ไม่ได้ล็อกอินจะเห็นเฉพาะช่วงเวลาและชื่อเรื่องเท่านั้น
                  ชื่อผู้จองและข้อมูลติดต่อเป็นข้อมูลภายใน
                </p>
              )}
            </Card>
          </div>

          {/* ---------- คอลัมน์ขวา ---------- */}
          <div className="space-y-5">
            <Card>
              <CardHeader title="อุปกรณ์ในห้อง" />
              {equipment.length === 0 ? (
                <p className="text-sm text-ink-400">ไม่มีอุปกรณ์ประจำห้อง</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {equipment.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start gap-2 rounded-xl border border-ink-100 px-3 py-2.5 text-sm leading-snug text-ink-700"
                    >
                      <EquipmentIcon icon={e.icon} className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      <span>{e.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="กติกาการจองห้องนี้" icon={<IconShield className="h-4.5 w-4.5" />} />
              <dl className="space-y-3 text-sm">
                {[
                  ["การอนุมัติ", "แอดมินเป็นผู้พิจารณาอนุมัติ"],
                  ["เวลาที่จองได้", `${hours.open} – ${hours.close} น.`],
                  ["จองล่วงหน้า", `อย่างน้อย ${POLICY.leadTimeDays} วัน · ไกลสุด ${POLICY.bookingHorizonDays} วัน`],
                  ["ความยาวต่อครั้ง", `ขั้นต่ำ ${POLICY.minDurationMinutes} นาที · ไม่จำกัดสูงสุด`],
                  ["ยกเลิก", `ล่วงหน้าอย่างน้อย ${POLICY.cancelNoticeHours} ชั่วโมง`],
                  ["ความจุ", unit.capacity > 0 ? `${unit.capacity} คน` : "ไม่ระบุ"],
                  ["บุคคลภายนอก", unit.openToGuest ? "จองได้" : "จองไม่ได้"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4">
                    <dt className="text-ink-400">{k}</dt>
                    <dd className="text-right font-medium text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-xs leading-relaxed text-brand-900">
                <IconClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {unit.contactNote}
              </p>
            </Card>

            <Card>
              <CardHeader title={`ห้องอื่นในชั้น ${floor.floorNo}`} />
              {siblings.length === 0 ? (
                <p className="text-sm text-ink-400">ไม่มีห้องอื่นในชั้นนี้</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {siblings.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/rooms/${s.code}`}
                        className={cx(
                          "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition",
                          s.isBookable
                            ? "border-ink-200 text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                            : "border-ink-100 bg-ink-50 text-ink-400",
                        )}
                      >
                        {s.code}
                        {s.capacity > 0 && (
                          <span className="flex items-center gap-1 text-xs text-ink-400">
                            <IconUsers className="h-3 w-3" />{s.capacity}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {unit.isBookable && (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
                <p className="font-semibold text-brand-900">พร้อมจองห้องนี้แล้วหรือยัง</p>
                <p className="mt-1 text-sm leading-relaxed text-brand-800">
                  วันแรกที่จองได้คือ {thaiDateMedium(addDays(today, POLICY.leadTimeDays))}
                </p>
                <ButtonLink href={`/book?unit=${unit.code}`} className="mt-3 w-full">
                  ไปหน้าจองห้อง
                </ButtonLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
