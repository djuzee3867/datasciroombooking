"use client";

/**
 * ตารางรวมทั้งอาคาร — "ห้องเป็นแถว × เวลาเป็นคอลัมน์" (plan001.md §10)
 * แยกสีตามประเภทการจอง และมีลวดลาย + ป้ายกำกับควบคู่เสมอ ไม่พึ่งสีอย่างเดียว
 */

import { CATEGORY_META } from "@/lib/policy";
import type { ScheduleEntry } from "@/lib/repo";
import type { BookableUnit } from "@/lib/types";
import { cx } from "@/components/ui/primitives";
import { hhmmOf, hhmmToMinutes, minutesOfDay, minutesToHhmm } from "@/lib/time";

export function RoomsGrid({
  rows,
  hours,
  onEntryClick,
  nowMinutes,
}: {
  rows: { unit: BookableUnit; entries: ScheduleEntry[] }[];
  hours: { open: string; close: string };
  onEntryClick?: (e: ScheduleEntry) => void;
  nowMinutes?: number;
}) {
  const open = hhmmToMinutes(hours.open);
  const close = hhmmToMinutes(hours.close);
  const span = close - open;
  const pct = (m: number) => ((Math.min(Math.max(m, open), close) - open) / span) * 100;

  const ticks: number[] = [];
  for (let m = open; m <= close; m += 60) ticks.push(m);

  return (
    <div className="thin-scroll overflow-x-auto rounded-xl border border-ink-100 bg-white">
      <div className="min-w-[52rem]">
        {/* หัวตาราง */}
        <div className="sticky top-0 z-10 flex border-b border-ink-100 bg-white">
          <div className="w-44 shrink-0 border-r border-ink-100 px-3 py-2 text-xs font-semibold text-ink-500">
            ห้อง
          </div>
          <div className="relative h-9 flex-1">
            {ticks.map((m, i) => (
              <span
                key={m}
                className={cx(
                  "absolute top-2.5 text-[11px] tabular-nums text-ink-400",
                  i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                  i === 0 && "translate-x-0",
                )}
                style={{ left: `${pct(m)}%` }}
              >
                {minutesToHhmm(m)}
              </span>
            ))}
          </div>
        </div>

        {rows.map(({ unit, entries }) => (
          <div key={unit.id} className="flex border-b border-ink-100 last:border-b-0">
            <div className="w-44 shrink-0 border-r border-ink-100 px-3 py-2.5">
              <p className="truncate text-sm font-medium text-ink-900">{unit.code}</p>
              <p className="truncate text-[11px] text-ink-400">
                {unit.isBookable ? `${unit.capacity} ที่นั่ง · ${unit.roomType}` : "จองไม่ได้"}
              </p>
            </div>

            <div
              className={cx(
                "relative h-14 flex-1",
                !unit.isBookable && "bg-[repeating-linear-gradient(-45deg,#f4f2f9_0_6px,transparent_6px_12px)]",
              )}
            >
              {ticks.slice(1, -1).map((m) => (
                <span
                  key={m}
                  className="absolute inset-y-0 w-px bg-ink-100"
                  style={{ left: `${pct(m)}%` }}
                  aria-hidden
                />
              ))}

              {entries.map((e) => {
                const meta = CATEGORY_META[e.category];
                const l = pct(minutesOfDay(e.startAt));
                const r = pct(minutesOfDay(e.endAt));
                const Tag = onEntryClick ? "button" : "div";
                return (
                  <Tag
                    key={e.id}
                    {...(onEntryClick ? { onClick: () => onEntryClick(e), type: "button" as const } : {})}
                    title={`${unit.code} · ${hhmmOf(e.startAt)}–${hhmmOf(e.endAt)} · ${e.publicTitle} · ${meta.label}`}
                    className={cx(
                      "absolute inset-y-2 flex flex-col justify-center overflow-hidden rounded-lg px-2 text-left text-[11px] leading-tight text-white transition",
                      meta.color,
                      meta.pattern,
                      e.status === "PENDING" && "opacity-80 ring-2 ring-inset ring-white/70",
                      onEntryClick && "cursor-pointer hover:brightness-110",
                    )}
                    style={{ left: `${l}%`, width: `${Math.max(r - l, 1.5)}%` }}
                  >
                    <span className="truncate font-semibold drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]">
                      <span aria-hidden>{meta.mark}</span> {e.publicTitle}
                    </span>
                    {r - l > 9 && (
                      <span className="truncate opacity-90">
                        {hhmmOf(e.startAt)}–{hhmmOf(e.endAt)}
                        {e.status === "PENDING" && " · รออนุมัติ"}
                      </span>
                    )}
                  </Tag>
                );
              })}

              {nowMinutes !== undefined && nowMinutes >= open && nowMinutes <= close && (
                <span
                  className="absolute inset-y-0 z-10 w-0.5 bg-rose-500/70"
                  style={{ left: `${pct(nowMinutes)}%` }}
                  aria-hidden
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
