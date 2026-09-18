"use client";

/**
 * โหมดจอแสดงผลหน้าห้อง (plan001.md §9) — เต็มจอ รีเฟรชเอง
 * แสดงเฉพาะ publicTitle ตามนโยบายความเป็นส่วนตัว (§11.1)
 */

import { useStore } from "@/lib/store";
import { unitStatusAt } from "@/lib/conflicts";
import { getUnitByCode, scheduleForDay } from "@/lib/repo";
import { hhmmOf, thaiDateLong } from "@/lib/time";
import { cx } from "@/components/ui/primitives";
import { ORG } from "@/components/layout/SiteShell";

export function RoomDisplay({ code }: { code: string }) {
  const { db, today, nowIso } = useStore();
  const unit = getUnitByCode(db, code);

  if (!unit) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-950 text-white">
        <p className="text-2xl">ไม่พบห้องรหัส {code}</p>
      </div>
    );
  }

  const live = unitStatusAt(db, unit.id, nowIso);
  const entries = scheduleForDay(db, unit.id, today);
  const now = new Date(nowIso).getTime();
  const upcoming = entries.filter((e) => new Date(e.endAt).getTime() > now);
  const current = upcoming.find((e) => new Date(e.startAt).getTime() <= now);
  const next = upcoming.filter((e) => e !== current);

  const free = live.status === "FREE";

  return (
    <div
      className={cx(
        "flex min-h-screen flex-col p-8 text-white transition-colors sm:p-12",
        free ? "bg-emerald-700" : live.status === "BUSY" ? "bg-rose-800" : "bg-brand-950",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/60">อาคาร SCB4</p>
          <h1 className="mt-1 text-4xl font-bold sm:text-6xl">{unit.code}</h1>
          <p className="mt-1 text-lg text-white/75 sm:text-2xl">{unit.name}</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums sm:text-6xl">{hhmmOf(nowIso)}</p>
          <p className="mt-1 text-sm text-white/70 sm:text-lg">{thaiDateLong(today)}</p>
        </div>
      </header>

      <div className="my-auto py-10">
        <p className="text-6xl font-bold sm:text-8xl">
          {free ? "ว่าง" : live.status === "BUSY" ? "ไม่ว่าง" : "นอกเวลาให้บริการ"}
        </p>
        {current && (
          <p className="mt-4 text-2xl text-white/85 sm:text-4xl">
            {current.publicTitle} · {hhmmOf(current.startAt)}–{hhmmOf(current.endAt)} น.
          </p>
        )}
        {free && next[0] && (
          <p className="mt-4 text-xl text-white/75 sm:text-3xl">
            คิวถัดไป {hhmmOf(next[0].startAt)} น. · {next[0].publicTitle}
          </p>
        )}
        {free && !next[0] && (
          <p className="mt-4 text-xl text-white/70 sm:text-3xl">ไม่มีคิวถัดไปในวันนี้</p>
        )}
      </div>

      <footer>
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-white/50">คิวถัดไปวันนี้</p>
        <ul className="flex flex-wrap gap-3">
          {next.length === 0 ? (
            <li className="rounded-2xl bg-white/10 px-5 py-3 text-white/70">— ไม่มี —</li>
          ) : (
            next.slice(0, 4).map((e) => (
              <li key={e.id} className="rounded-2xl bg-white/12 px-5 py-3 backdrop-blur">
                <p className="text-lg font-semibold tabular-nums">
                  {hhmmOf(e.startAt)}–{hhmmOf(e.endAt)}
                </p>
                <p className="text-sm text-white/75">{e.publicTitle}</p>
              </li>
            ))
          )}
        </ul>
        <p className="mt-6 text-xs text-white/45">
          แสดงเฉพาะช่วงเวลาและชื่อเรื่องตามนโยบายความเป็นส่วนตัว · หน้าจอนี้อัปเดตอัตโนมัติทุกนาที
        </p>
        <p className="mt-2 text-xs tracking-wide text-white/35">
          {ORG.name} · {ORG.faculty} · Tel. {ORG.tel}
        </p>
      </footer>
    </div>
  );
}
