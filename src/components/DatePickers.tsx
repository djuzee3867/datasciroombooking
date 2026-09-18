"use client";

/**
 * ตัวเลือกวันที่ 2 แบบ
 *  - DateStrip: แถบวันแนวนอนสำหรับ "ดูตาราง" (ดูย้อนหลัง/ล่วงหน้าได้อิสระ)
 *  - AvailabilityCalendar: ปฏิทินรายเดือนพร้อม heatmap ความว่าง สำหรับ "เลือกวันจอง"
 *    วันที่จองไม่ได้ต้อง disabled พร้อมบอกเหตุผล (§8.3 · ภาคผนวก ก ข้อ 2)
 */

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { dateSelectable, dayLoad } from "@/lib/conflicts";
import { holidayOn } from "@/lib/repo";
import {
  addDays, addMonths, daysInMonth, diffDays, isWeekend, startOfMonth,
  thaiDateShort, thaiMonthYear, thaiWeekdayShort, weekdayOf, THAI_WEEKDAY_HEADERS,
} from "@/lib/time";
import { cx } from "@/components/ui/primitives";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";

export function DateStrip({
  value,
  onChange,
  days = 14,
  from,
}: {
  value: string;
  onChange: (d: string) => void;
  days?: number;
  from?: string;
}) {
  const { db, today } = useStore();
  const start = from ?? addDays(value, -2);
  const list = Array.from({ length: days }, (_, i) => addDays(start, i));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(addDays(value, -1))}
        aria-label="วันก่อนหน้า"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-200 text-ink-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
      >
        <IconChevronLeft className="h-4 w-4" />
      </button>

      <div className="thin-scroll flex flex-1 gap-1.5 overflow-x-auto py-1">
        {list.map((d) => {
          const active = d === value;
          const hol = holidayOn(db, d);
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              aria-current={active ? "date" : undefined}
              className={cx(
                "flex w-[4.2rem] shrink-0 flex-col items-center rounded-xl border px-1 py-2 transition",
                active
                  ? "border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                  : "border-ink-100 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50",
              )}
            >
              <span className={cx("text-[11px]", active ? "text-white/80" : "text-ink-400")}>
                {thaiWeekdayShort(d)}
              </span>
              <span className="text-sm font-semibold tabular-nums">{thaiDateShort(d)}</span>
              <span
                className={cx(
                  "mt-0.5 h-1.5 w-1.5 rounded-full",
                  d === today ? (active ? "bg-white" : "bg-brand-500")
                    : hol ? (active ? "bg-amber-200" : "bg-amber-400")
                      : "bg-transparent",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onChange(addDays(value, 1))}
        aria-label="วันถัดไป"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-200 text-ink-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
      >
        <IconChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function loadTone(load: number) {
  if (load >= 0.85) return { cell: "bg-rose-100 text-rose-700", label: "เต็มเกือบทั้งวัน" };
  if (load >= 0.45) return { cell: "bg-amber-100 text-amber-800", label: "ว่างน้อย" };
  if (load > 0) return { cell: "bg-emerald-50 text-emerald-700", label: "ว่างมาก" };
  return { cell: "bg-white text-ink-700", label: "ว่างทั้งวัน" };
}

export function AvailabilityCalendar({
  unitId,
  value,
  onChange,
  months = 2,
}: {
  /** ถ้าไม่ระบุ unit จะไม่แสดง heatmap (ใช้ตอนยังไม่เลือกห้อง) */
  unitId?: string;
  value: string | null;
  onChange: (d: string) => void;
  months?: number;
}) {
  const { db, today } = useStore();
  const [monthOffset, setMonthOffset] = useState(0);
  const baseMonth = startOfMonth(today);

  const monthKey = addMonths(baseMonth, monthOffset);
  const total = daysInMonth(monthKey);
  const firstWeekday = weekdayOf(monthKey);

  const cells = useMemo(() => {
    const out: (string | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= total; d++) {
      out.push(`${monthKey.slice(0, 7)}-${String(d).padStart(2, "0")}`);
    }
    return out;
  }, [firstWeekday, total, monthKey]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setMonthOffset((v) => Math.max(0, v - 1))}
          disabled={monthOffset === 0}
          aria-label="เดือนก่อนหน้า"
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-50 disabled:opacity-30"
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-ink-900">{thaiMonthYear(monthKey)}</p>
        <button
          onClick={() => setMonthOffset((v) => Math.min(months - 1, v + 1))}
          disabled={monthOffset >= months - 1}
          aria-label="เดือนถัดไป"
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-50 disabled:opacity-30"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {THAI_WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={cx("pb-1 text-[11px] font-medium", i === 0 || i === 6 ? "text-brand-500" : "text-ink-400")}
          >
            {d}
          </div>
        ))}

        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const sel = dateSelectable(d, today);
          const hol = holidayOn(db, d);
          const load = unitId && sel.selectable ? dayLoad(db, unitId, d) : 0;
          const tone = loadTone(load);
          const active = value === d;
          const isToday = d === today;

          return (
            <button
              key={d}
              onClick={() => sel.selectable && onChange(d)}
              disabled={!sel.selectable}
              title={sel.selectable ? `${tone.label}${hol ? ` · ${hol.name}` : ""}` : sel.reason}
              aria-label={`${thaiDateShort(d)} ${sel.selectable ? tone.label : sel.reason}`}
              className={cx(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[13px] tabular-nums transition",
                !sel.selectable && "cursor-not-allowed border-ink-100/70 bg-ink-50/70 text-ink-300 line-through",
                sel.selectable && !active && cx("border-ink-100 hover:border-brand-400", tone.cell),
                active && "border-brand-600 bg-brand-600 font-semibold text-white shadow-sm shadow-brand-600/25",
              )}
            >
              {Number(d.slice(8))}
              {isToday && !active && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" aria-hidden />
              )}
              {hol && sel.selectable && !active && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-ink-100 pt-3 text-[11px] text-ink-400">
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-ink-200 bg-white" />ว่างทั้งวัน</li>
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-100" />ว่างมาก</li>
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-100" />ว่างน้อย</li>
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-rose-100" />เต็มเกือบทั้งวัน</li>
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />วันหยุด (ยังจองได้)</li>
      </ul>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
        เสาร์–อาทิตย์และวันหยุดเลือกได้ตามปกติ · วันที่ขีดฆ่าคือวันที่ยังจองไม่ได้ตามกฎจองล่วงหน้า
      </p>
    </div>
  );
}

export function leadHint(today: string, dateKey: string) {
  const d = diffDays(today, dateKey);
  if (isWeekend(dateKey)) return `${d} วันข้างหน้า · วันหยุดสุดสัปดาห์`;
  return `${d} วันข้างหน้า`;
}
