"use client";

/**
 * แถบตารางเวลารายวันของห้องหนึ่ง (อ้างอิง pic/main2.png, pic/main3.png)
 *
 * - เลื่อนแนวนอนภายในกล่องของตัวเอง ไม่ทำให้ทั้งหน้าเลื่อน (§11.2 Responsive)
 * - อ่านด้วย screen reader ได้ผ่านรายการข้อความที่ซ่อนไว้
 * - รองรับ "แท่งร่าง" (ghost) สำหรับวาดเวลาที่ผู้ใช้กำลังกรอกทับลงไปแบบ real-time (§8.3)
 */

import { CATEGORY_META } from "@/lib/policy";
import type { ScheduleEntry } from "@/lib/repo";
import { cx } from "@/components/ui/primitives";
import { hhmmOf, hhmmToMinutes, minutesOfDay, minutesToHhmm } from "@/lib/time";

export interface GhostRange {
  startTime: string;
  endTime: string;
  invalid?: boolean;
  label?: string;
}

export function TimelineBar({
  entries,
  hours,
  ghost,
  height = "h-12",
  onEntryClick,
  emptyLabel = "ยังไม่มีรายการจองในช่วงเวลานี้",
  showNowMarker = false,
  nowMinutes,
}: {
  entries: ScheduleEntry[];
  hours: { open: string; close: string };
  ghost?: GhostRange | null;
  height?: string;
  onEntryClick?: (entry: ScheduleEntry) => void;
  emptyLabel?: string;
  showNowMarker?: boolean;
  nowMinutes?: number;
}) {
  const open = hhmmToMinutes(hours.open);
  const close = hhmmToMinutes(hours.close);
  const span = Math.max(close - open, 60);

  const ticks: number[] = [];
  for (let m = open; m <= close; m += 60) ticks.push(m);

  const pct = (m: number) => ((Math.min(Math.max(m, open), close) - open) / span) * 100;

  return (
    <div className="thin-scroll -mx-1 overflow-x-auto px-1 pb-1">
      <div className="min-w-[42rem]">
        {/* หัวบอกชั่วโมง */}
        <div className="relative mb-1 h-4 select-none" aria-hidden>
          {ticks.map((m, i) => (
            <span
              key={m}
              className={cx(
                "absolute top-0 text-[11px] tabular-nums text-ink-400",
                i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                i === 0 && "translate-x-0",
              )}
              style={{ left: `${pct(m)}%` }}
            >
              {minutesToHhmm(m)}
            </span>
          ))}
        </div>

        <div
          className={cx(
            "relative overflow-hidden rounded-xl border border-ink-100 bg-ink-50/50",
            height,
          )}
        >
          {/* เส้นแบ่งชั่วโมง */}
          {ticks.slice(1, -1).map((m) => (
            <span
              key={m}
              className="absolute inset-y-0 w-px bg-ink-100"
              style={{ left: `${pct(m)}%` }}
              aria-hidden
            />
          ))}

          {entries.length === 0 && !ghost && (
            <span className="absolute inset-0 grid place-items-center text-xs text-ink-400">
              {emptyLabel}
            </span>
          )}

          {entries.map((e) => {
            const meta = CATEGORY_META[e.category];
            const left = pct(minutesOfDay(e.startAt));
            const right = pct(minutesOfDay(e.endAt));
            const width = Math.max(right - left, 1.6);
            const isPending = e.status === "PENDING";
            const isBlocked = e.kind === "BLACKOUT";
            const Tag = onEntryClick ? "button" : "div";
            return (
              <Tag
                key={e.id}
                {...(onEntryClick ? { onClick: () => onEntryClick(e), type: "button" as const } : {})}
                title={`${hhmmOf(e.startAt)}–${hhmmOf(e.endAt)} · ${e.publicTitle}`}
                className={cx(
                  "absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-lg px-1.5 text-[11px] font-medium text-white transition",
                  meta.color,
                  meta.pattern,
                  isPending && "opacity-75 ring-2 ring-inset ring-white/60",
                  isBlocked && "opacity-90",
                  onEntryClick && "cursor-pointer hover:brightness-110",
                )}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <span className="truncate drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]">
                  {width > 14
                    ? `${hhmmOf(e.startAt)}–${hhmmOf(e.endAt)} · ${e.publicTitle}`
                    : width > 7
                      ? e.publicTitle
                      : "•"}
                </span>
              </Tag>
            );
          })}

          {/* แท่งร่างของเวลาที่กำลังกรอก */}
          {ghost && (() => {
            const l = pct(hhmmToMinutes(ghost.startTime));
            const r = pct(hhmmToMinutes(ghost.endTime));
            if (r <= l) return null;
            return (
              <div
                className={cx(
                  "absolute inset-y-1 flex items-center justify-center rounded-lg border-2 border-dashed px-1.5 text-[11px] font-semibold",
                  ghost.invalid
                    ? "border-rose-500 bg-rose-500/25 text-rose-800"
                    : "border-brand-600 bg-brand-500/25 text-brand-900",
                )}
                style={{ left: `${l}%`, width: `${Math.max(r - l, 1.6)}%` }}
              >
                <span className="truncate">{ghost.label ?? `${ghost.startTime}–${ghost.endTime}`}</span>
              </div>
            );
          })()}

          {showNowMarker && nowMinutes !== undefined && nowMinutes >= open && nowMinutes <= close && (
            <span
              className="absolute inset-y-0 z-10 w-0.5 bg-rose-500"
              style={{ left: `${pct(nowMinutes)}%` }}
              aria-hidden
            >
              <span className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-rose-500" />
            </span>
          )}
        </div>
      </div>

      {/* สำหรับ screen reader */}
      <ul className="sr-only">
        {entries.length === 0 && <li>{emptyLabel}</li>}
        {entries.map((e) => (
          <li key={e.id}>
            {hhmmOf(e.startAt)} ถึง {hhmmOf(e.endAt)} — {e.publicTitle}
            {e.status === "PENDING" ? " (รออนุมัติ)" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** คำอธิบายสี + ลวดลาย — §10 ห้ามสื่อความหมายด้วยสีอย่างเดียว */
export function CategoryLegend({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={cx("flex flex-wrap gap-x-4 gap-y-2", compact ? "text-[11px]" : "text-xs")}>
      {Object.entries(CATEGORY_META).map(([key, meta]) => (
        <li key={key} className="flex items-center gap-1.5 text-ink-500">
          <span
            className={cx("legend-swatch h-3 w-5 rounded", meta.color, meta.pattern)}
            aria-hidden
          />
          {meta.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5 text-ink-500">
        <span className="h-3 w-5 rounded border-2 border-dashed border-brand-500 bg-brand-100" aria-hidden />
        เวลาที่กำลังเลือก
      </li>
    </ul>
  );
}
