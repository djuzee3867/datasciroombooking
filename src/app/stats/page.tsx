"use client";

/**
 * สถิติการใช้งาน (plan001.md §8.4)
 * - สาธารณะ: เห็นสถิติรายห้องได้ แต่ไม่เห็นตัวบุคคล
 * - ADMIN: เห็นสถิติรายหน่วยงานเพิ่ม
 * - ปกปิดกลุ่มที่เล็กกว่า POLICY.statsMinGroupSize เพื่อกันการเดาตัวบุคคล
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_META, POLICY } from "@/lib/policy";
import { hasRole, monthStats } from "@/lib/repo";
import { addMonths, dateKeyOf, startOfMonth, thaiMonthYear, THAI_WEEKDAY_HEADERS } from "@/lib/time";
import { PageShell, PageHeading } from "@/components/layout/SiteShell";
import { Badge, Card, CardHeader, EmptyState, Select, Stat, cx } from "@/components/ui/primitives";
import { IconChart, IconLock, IconShield } from "@/components/ui/icons";

export default function StatsPage() {
  const { db, today, viewer } = useStore();
  const [offset, setOffset] = useState(0);
  const monthStart = addMonths(startOfMonth(today), offset);
  const monthKey = monthStart.slice(0, 7);
  const stats = monthStats(db, monthKey);
  const isAdmin = hasRole(viewer, "ADMIN", "SUPER_ADMIN");

  const maxHeat = Math.max(1, ...stats.heatmap.flat());
  const maxHours = Math.max(1, ...stats.perUnit.map((u) => u.hours));
  const totalCategory = stats.perCategory.reduce((s, c) => s + c.count, 0) || 1;

  // สถิติรายหน่วยงาน — เฉพาะแอดมิน และปกปิดกลุ่มเล็ก
  const byDepartment = (() => {
    const map = new Map<string, number>();
    for (const b of db.bookings) {
      if (!dateKeyOf(b.startAt).startsWith(monthKey)) continue;
      if (!["APPROVED", "IN_USE", "COMPLETED"].includes(b.status)) continue;
      const dep = db.users.find((u) => u.id === b.ownerId)?.department ?? "ไม่ระบุ";
      map.set(dep, (map.get(dep) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);
  })();

  return (
    <PageShell>
      <PageHeading
        eyebrow="ข้อมูลสาธารณะ"
        title="สถิติการใช้งานห้อง"
        description="ภาพรวมการใช้ห้องของอาคาร SCB4 รายเดือน — แสดงเฉพาะข้อมูลรวม ไม่เปิดเผยตัวบุคคล"
        action={
          <div className="w-56">
            <Select value={String(offset)} onChange={(e) => setOffset(Number(e.target.value))}>
              {[0, -1, -2, -3].map((o) => (
                <option key={o} value={o}>{thaiMonthYear(addMonths(startOfMonth(today), o))}</option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {stats.totalBookings === 0 ? (
          <EmptyState title="ยังไม่มีข้อมูลการใช้งานในเดือนนี้" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="รายการจองในเดือนนี้" value={stats.totalBookings} unit="รายการ" />
              <Stat label="ชั่วโมงการใช้งานรวม" value={stats.totalHours} unit="ชม." tone="emerald" />
              <Stat
                label="จำนวนผู้ใช้ที่ไม่ซ้ำ"
                value={stats.uniqueUsers}
                unit="คน"
                tone="slate"
                hint="นับจากบัญชีผู้จอง ไม่เปิดเผยรายชื่อ"
              />
              <Stat
                label="อัตราคำขอที่ได้รับอนุมัติ"
                value={Math.round(stats.approvalRate * 100)}
                unit="%"
                tone="amber"
              />
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              {/* Heatmap วัน × เวลา */}
              <Card>
                <CardHeader
                  icon={<IconChart className="h-4.5 w-4.5" />}
                  title="ช่วงเวลาที่คนใช้ห้องเยอะ"
                  subtitle={`จำนวนรายการที่ใช้งานในแต่ละชั่วโมง · ${thaiMonthYear(monthStart)}`}
                />
                <div className="thin-scroll overflow-x-auto">
                  <table className="w-full min-w-[34rem] border-separate border-spacing-1">
                    <caption className="sr-only">
                      ตารางความหนาแน่นการใช้ห้อง แยกตามวันในสัปดาห์และชั่วโมง
                    </caption>
                    <thead>
                      <tr>
                        <th className="w-10" />
                        {Array.from({ length: 12 }, (_, h) => (
                          <th key={h} className="pb-1 text-[10px] font-medium text-ink-400">
                            {String(h + 7).padStart(2, "0")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.heatmap.map((row, wd) => (
                        <tr key={wd}>
                          <th className="pr-1 text-right text-[11px] font-medium text-ink-400">
                            {THAI_WEEKDAY_HEADERS[wd]}
                          </th>
                          {row.map((v, h) => {
                            const ratio = v / maxHeat;
                            return (
                              <td key={h}>
                                <div
                                  title={`${THAI_WEEKDAY_HEADERS[wd]} ${h + 7}:00 น. — ${v} รายการ`}
                                  className={cx(
                                    "grid h-7 place-items-center rounded text-[10px] font-medium tabular-nums",
                                    v === 0
                                      ? "bg-ink-50 text-transparent"
                                      : ratio > 0.66
                                        ? "bg-brand-600 text-white"
                                        : ratio > 0.33
                                          ? "bg-brand-300 text-brand-900"
                                          : "bg-brand-100 text-brand-700",
                                  )}
                                >
                                  {v || 0}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
                  ใช้น้อย
                  <span className="h-3 w-6 rounded bg-ink-50" />
                  <span className="h-3 w-6 rounded bg-brand-100" />
                  <span className="h-3 w-6 rounded bg-brand-300" />
                  <span className="h-3 w-6 rounded bg-brand-600" />
                  ใช้มาก
                </div>
              </Card>

              {/* สัดส่วนประเภทการใช้งาน */}
              <Card>
                <CardHeader title="ประเภทการใช้งาน" subtitle="สัดส่วนของรายการจองที่ได้รับอนุมัติ" />
                <ul className="space-y-3">
                  {stats.perCategory.map((c) => {
                    const meta = CATEGORY_META[c.category];
                    const pct = Math.round((c.count / totalCategory) * 100);
                    return (
                      <li key={c.category}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-ink-700">
                            <span className={cx("legend-swatch h-3 w-4 rounded", meta.color, meta.pattern)} aria-hidden />
                            {meta.label}
                          </span>
                          <span className="tabular-nums text-ink-500">{c.count} · {pct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                          <div className={cx("h-full rounded-full", meta.color)} style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>

            {/* อัตราการใช้รายห้อง */}
            <Card className="mt-5">
              <CardHeader
                title="อัตราการใช้งานรายห้อง"
                subtitle="เทียบชั่วโมงการใช้งานจริงกับเวลาให้บริการทั้งเดือน"
              />
              <ul className="space-y-3">
                {stats.perUnit.map((u) => (
                  <li key={u.unitId} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{u.name}</p>
                      <p className="text-xs text-ink-400">{u.code}</p>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={cx(
                          "h-full rounded-full",
                          u.utilization > 0.6 ? "bg-rose-500" : u.utilization > 0.3 ? "bg-amber-500" : "bg-brand-500",
                        )}
                        style={{ width: `${Math.max(2, (u.hours / maxHours) * 100)}%` }}
                      />
                    </div>
                    <p className="text-right text-xs tabular-nums text-ink-500">
                      {u.hours} ชม. · {u.count} รายการ · {Math.round(u.utilization * 100)}%
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-400">
                <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                สถิติสาธารณะแสดงเฉพาะข้อมูลระดับห้อง ไม่เปิดเผยชื่อผู้จองหรือรายละเอียดการใช้งาน ·
                กลุ่มข้อมูลที่มีน้อยกว่า {POLICY.statsMinGroupSize} รายการจะถูกปกปิด
              </p>
            </Card>

            {/* เฉพาะแอดมิน */}
            <Card className="mt-5">
              <CardHeader
                icon={<IconShield className="h-4.5 w-4.5" />}
                title="สถิติรายหน่วยงาน"
                subtitle="ข้อมูลภายใน เห็นได้เฉพาะแอดมินเท่านั้น"
                action={
                  isAdmin
                    ? <Badge className="bg-brand-50 text-brand-700 ring-brand-200">มุมมองแอดมิน</Badge>
                    : <Badge className="bg-ink-50 text-ink-500 ring-ink-200" dot="bg-ink-400">ต้องมีสิทธิ์แอดมิน</Badge>
                }
              />
              {!isAdmin ? (
                <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-4 py-8 text-center">
                  <IconLock className="mx-auto h-5 w-5 text-ink-300" />
                  <p className="mt-2 text-sm text-ink-500">
                    ส่วนนี้ถูกซ่อนไว้ตามนโยบายความเป็นส่วนตัว
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {byDepartment.map((d) => {
                    const hidden = d.count < POLICY.statsMinGroupSize;
                    return (
                      <li key={d.department} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                        <span className="text-ink-700">{d.department}</span>
                        <span className={cx("tabular-nums", hidden ? "text-ink-300" : "text-ink-900")}>
                          {hidden ? `< ${POLICY.statsMinGroupSize} (ปกปิด)` : `${d.count} รายการ`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}
