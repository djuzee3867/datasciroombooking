"use client";

/**
 * ตารางแบบ "วันเป็นคอลัมน์ × เวลาเป็นแถว" (อ้างอิง pic/detail1.png)
 * ใช้ในหน้ารายละเอียดห้อง: ย้อนหลัง 2 วัน + ล่วงหน้า 3 วัน เลื่อนดูช่วงอื่นได้ (§8.2)
 */

import { CATEGORY_META } from "@/lib/policy";
import type { ScheduleEntry } from "@/lib/repo";
import { cx } from "@/components/ui/primitives";
import {
  hhmmOf, hhmmToMinutes, minutesOfDay, minutesToHhmm, thaiDateShort, thaiWeekdayShort,
} from "@/lib/time";

export function DayColumnsGrid({
  days,
  hours,
  today,
  selected,
  onSelectDay,
  onEntryClick,
  rowHeight = 46,
}: {
  days: { dateKey: string; entries: ScheduleEntry[] }[];
  hours: { open: string; close: string };
  today: string;
  selected?: string;
  onSelectDay?: (d: string) => void;
  onEntryClick?: (e: ScheduleEntry) => void;
  rowHeight?: number;
}) {
  const open = hhmmToMinutes(hours.open);
  const close = hhmmToMinutes(hours.close);
  const hourCount = Math.ceil((close - open) / 60);
  const gridHeight = hourCount * rowHeight;
  const topPct = (m: number) => ((Math.min(Math.max(m, open), close) - open) / (close - open)) * 100;

  return (
    <div className="thin-scroll overflow-x-auto">
      <div className="min-w-[40rem]">
        {/* หัวคอลัมน์วัน */}
        <div
          className="grid border-b border-ink-100"
          style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div />
          {days.map(({ dateKey }) => {
            const isToday = dateKey === today;
            const isSel = selected === dateKey;
            const Tag = onSelectDay ? "button" : "div";
            return (
              <Tag
                key={dateKey}
                {...(onSelectDay ? { onClick: () => onSelectDay(dateKey), type: "button" as const } : {})}
                className={cx(
                  "border-l border-ink-100 py-2 text-center transition",
                  onSelectDay && "cursor-pointer hover:bg-brand-50",
                  isSel && "bg-brand-50",
                )}
              >
                <span
                  className={cx(
                    "block text-[11px]",
                    isToday ? "font-semibold text-brand-600" : "text-ink-400",
                  )}
                >
                  {thaiWeekdayShort(dateKey)}
                </span>
                <span
                  className={cx(
                    "block text-sm font-semibold tabular-nums",
                    isToday ? "text-brand-700" : "text-ink-900",
                  )}
                >
                  {thaiDateShort(dateKey)}
                </span>
              </Tag>
            );
          })}
        </div>

        {/* ตาราง */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))`,
            height: gridHeight,
          }}
        >
          {/* คอลัมน์เวลา */}
          <div className="relative">
            {Array.from({ length: hourCount + 1 }, (_, i) => (
              <span
                key={i}
                className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-ink-400"
                style={{ top: (i / hourCount) * 100 + "%" }}
              >
                {minutesToHhmm(open + i * 60)}
              </span>
            ))}
          </div>

          {days.map(({ dateKey, entries }) => (
            <div key={dateKey} className="relative border-l border-ink-100">
              {Array.from({ length: hourCount }, (_, i) => (
                <span
                  key={i}
                  className="absolute inset-x-0 border-t border-ink-100"
                  style={{ top: (i / hourCount) * 100 + "%" }}
                  aria-hidden
                />
              ))}

              {entries.map((e) => {
                const top = topPct(minutesOfDay(e.startAt));
                const bottom = topPct(minutesOfDay(e.endAt));
                const meta = CATEGORY_META[e.category];
                const Tag = onEntryClick ? "button" : "div";
                return (
                  <Tag
                    key={e.id}
                    {...(onEntryClick ? { onClick: () => onEntryClick(e), type: "button" as const } : {})}
                    title={`${hhmmOf(e.startAt)}–${hhmmOf(e.endAt)} · ${e.publicTitle}`}
                    className={cx(
                      "absolute inset-x-1 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight text-white transition",
                      meta.color,
                      meta.pattern,
                      e.status === "PENDING" && "opacity-75 ring-2 ring-inset ring-white/60",
                      onEntryClick && "cursor-pointer hover:brightness-110",
                    )}
                    style={{ top: `${top}%`, height: `${Math.max(bottom - top, 3)}%` }}
                  >
                    <span className="block truncate font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]">
                      {e.publicTitle}
                    </span>
                    <span className="block truncate opacity-90">
                      {hhmmOf(e.startAt)}–{hhmmOf(e.endAt)}
                    </span>
                  </Tag>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
