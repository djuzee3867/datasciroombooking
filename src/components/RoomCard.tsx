"use client";

/**
 * การ์ดห้อง — ใช้ร่วมกันทั้งหน้าแรกและขั้นตอนเลือกห้อง (plan001.md §8.1, §8.3)
 * ปรับ UI ใหม่จาก pic/main2.png ให้อ่านง่ายขึ้น: ข้อมูลสำคัญอยู่บรรทัดเดียว
 * และตารางเวลาแยกกล่องชัดเจน กดขยายเพื่อดูวันถัด ๆ ไปได้
 */

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { bookingHoursOf, unitStatusAt } from "@/lib/conflicts";
import { equipmentOf, scheduleForDay, scheduleForRange } from "@/lib/repo";
import type { BookableUnit } from "@/lib/types";
import {
  addDays, hhmmOf, minutesOfDay, thaiDateShort, thaiWeekdayShort, todayKey,
} from "@/lib/time";
import { Badge, Button, ButtonLink, cx } from "@/components/ui/primitives";
import { EquipmentIcon, IconBan, IconChevronDown, IconClock, IconUsers } from "@/components/ui/icons";
import { RoomPhoto } from "@/components/RoomPhoto";
import { TimelineBar } from "@/components/schedule/TimelineBar";

const EXPAND_DAYS = 7;

export function RoomStatusBadge({ unitId, atIso }: { unitId: string; atIso: string }) {
  const { db } = useStore();
  const s = unitStatusAt(db, unitId, atIso);

  if (s.status === "UNBOOKABLE") {
    return <Badge className="bg-ink-100 text-ink-500 ring-ink-200" dot="bg-ink-400">จองไม่ได้</Badge>;
  }
  if (s.status === "CLOSED") {
    return <Badge className="bg-ink-50 text-ink-500 ring-ink-200" dot="bg-ink-300">นอกเวลาให้บริการ</Badge>;
  }
  if (s.status === "BUSY") {
    return (
      <Badge className="bg-rose-50 text-rose-700 ring-rose-200" dot="bg-rose-500">
        ไม่ว่างถึง {hhmmOf(s.until!)}
      </Badge>
    );
  }
  return <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200" dot="bg-emerald-500">ว่างตอนนี้</Badge>;
}

export function RoomCard({
  unit,
  dateKey,
  bookHref,
  onBook,
  highlighted = false,
}: {
  unit: BookableUnit;
  dateKey: string;
  bookHref?: string;
  onBook?: () => void;
  highlighted?: boolean;
}) {
  const { db, nowIso, today } = useStore();
  const [expanded, setExpanded] = useState(false);

  const hours = bookingHoursOf(unit);
  const entries = scheduleForDay(db, unit.id, dateKey);
  const equipment = equipmentOf(db, unit);
  const isToday = dateKey === today;
  const range = expanded ? scheduleForRange(db, unit.id, dateKey, EXPAND_DAYS) : [];

  return (
    <article
      id={`room-${unit.code}`}
      className={cx(
        "scroll-mt-24 overflow-hidden rounded-2xl border bg-white transition",
        highlighted
          ? "border-brand-400 shadow-[0_0_0_4px_rgba(132,89,242,.12)]"
          : "border-ink-100 shadow-[0_1px_2px_rgba(27,22,38,.04)] hover:border-ink-200",
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5">
        <Link
          href={`/rooms/${unit.code}`}
          className="group relative block shrink-0 overflow-hidden rounded-xl sm:w-52"
        >
          <RoomPhoto
            seed={unit.images[0] ?? "a"}
            code={unit.code}
            className="aspect-[16/10] w-full transition group-hover:scale-[1.03] sm:aspect-[4/3]"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-ink-900">
                <Link href={`/rooms/${unit.code}`} className="hover:text-brand-700">
                  {unit.name}
                </Link>
              </h3>
              <p className="mt-0.5 text-xs text-ink-400">
                {unit.code} · {unit.roomType}
              </p>
            </div>
            {isToday ? (
              <RoomStatusBadge unitId={unit.id} atIso={nowIso} />
            ) : unit.isBookable ? (
              <Badge
                className={
                  entries.length === 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200"
                }
                dot={entries.length === 0 ? "bg-emerald-500" : "bg-amber-500"}
              >
                {entries.length === 0 ? "ว่างทั้งวัน" : `มี ${entries.length} รายการ`}
              </Badge>
            ) : (
              <Badge className="bg-ink-100 text-ink-500 ring-ink-200" dot="bg-ink-400">จองไม่ได้</Badge>
            )}
          </div>

          <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-500">
            {unit.capacity > 0 && (
              <li className="flex items-center gap-1.5">
                <IconUsers className="h-4 w-4 text-ink-400" />
                {unit.capacity} ที่นั่ง
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <IconClock className="h-4 w-4 text-ink-400" />
              {hours.open}–{hours.close} น.
            </li>
            {equipment.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center gap-1.5">
                <EquipmentIcon icon={e.icon} className="h-4 w-4 text-ink-400" />
                {e.name}
              </li>
            ))}
            {equipment.length > 3 && (
              <li className="text-ink-400">+{equipment.length - 3} รายการ</li>
            )}
          </ul>

          {!unit.isBookable && unit.unbookableReason && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-500">
              <IconBan className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {unit.unbookableReason}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href={`/rooms/${unit.code}`} variant="secondary" size="sm">
              รายละเอียดห้อง
            </ButtonLink>
            {unit.isBookable
              && (onBook ? (
                <Button size="sm" onClick={onBook}>จองห้องนี้</Button>
              ) : (
                <ButtonLink href={bookHref ?? `/book?unit=${unit.code}`} size="sm">
                  จองห้องนี้
                </ButtonLink>
              ))}
          </div>
        </div>
      </div>

      {/* ตารางเวลา */}
      <div className="border-t border-ink-100 bg-ink-50/40 px-4 py-3.5 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-ink-500">
            ตารางวัน{thaiWeekdayShort(dateKey)} {thaiDateShort(dateKey)}
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
          >
            {expanded ? "ย่อ" : `ดูอีก ${EXPAND_DAYS - 1} วันข้างหน้า`}
            <IconChevronDown className={cx("h-3.5 w-3.5 transition", expanded && "rotate-180")} />
          </button>
        </div>

        <TimelineBar
          entries={entries}
          hours={hours}
          showNowMarker={isToday}
          nowMinutes={minutesOfDay(nowIso)}
        />

        {expanded && (
          <div className="animate-rise mt-3 space-y-2.5 border-t border-ink-100 pt-3">
            {range.slice(1).map(({ dateKey: dk, entries: es }) => (
              <div key={dk} className="flex items-start gap-3">
                <div className="mt-4 w-12 shrink-0 rounded-lg border border-ink-100 bg-white px-1.5 py-1 text-center">
                  <span className="block text-[11px] font-semibold text-ink-700">
                    {thaiWeekdayShort(dk)}
                  </span>
                  <span className="block text-[10px] text-ink-400">{thaiDateShort(dk)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <TimelineBar entries={es} hours={hours} height="h-9" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function nextDays(from: string, n: number) {
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

export { todayKey };
