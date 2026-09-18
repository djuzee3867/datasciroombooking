"use client";

/**
 * หน้าแอดมิน (plan001.md §10)
 * ADMIN คือผู้อนุมัติหลักของระบบ
 * SUPER_ADMIN เห็นทุกอย่างของ ADMIN เพิ่มการจัดการสิทธิ์ผู้ใช้
 */

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_META, POLICY, STATUS_META, bookingTerms } from "@/lib/policy";
import {
  approvalOf, listFloors, listUnits,
  monthStats, pendingQueue, scheduleForDay, type ScheduleEntry,
} from "@/lib/repo";
import { displayHours } from "@/lib/conflicts";
import type { Booking } from "@/lib/types";
import {
  addMonths, dateKeyOf, hhmmOf, minutesOfDay, startOfMonth, thaiDateLong,
  thaiDateMedium, thaiMonthYear,
} from "@/lib/time";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Modal, Notice,
  Select, Stat, Textarea, cx,
} from "@/components/ui/primitives";
import { IconCheck, IconDownload, IconShield, IconX } from "@/components/ui/icons";
import { RoomsGrid } from "@/components/schedule/RoomsGrid";
import { CategoryLegend } from "@/components/schedule/TimelineBar";
import { BookingDetailModal } from "@/components/BookingDetailModal";
import { DateStrip } from "@/components/DatePickers";
import { RoomsAdminTab } from "@/components/admin/RoomsAdminTab";
import { UsersAdminTab } from "@/components/admin/UsersAdminTab";
import { AuditLogTab } from "@/components/admin/AuditLogTab";
import { TermsCard } from "@/components/admin/TermsCard";
import { BookingListCard } from "@/components/admin/BookingListCard";
import { downloadCsv } from "@/lib/csv";

export default function AdminPage() {
  const { db, viewer } = useStore();
  const [tab, setTab] = useState("queue");
  const queue = useMemo(() => pendingQueue(db), [db]);

  return (
    <ConsoleShell
      title="หน้าแอดมิน"
      subtitle={viewer ? `${viewer.name} · ${viewer.department}` : "คิวอนุมัติและภาพรวมทั้งอาคาร"}
      accent="admin"
      requiredRoles={["ADMIN", "SUPER_ADMIN"]}
      activeTab={tab}
      onTab={setTab}
      tabs={[
        { value: "queue", label: "คิวอนุมัติ", count: queue.length },
        { value: "grid", label: "ตารางรวมทั้งอาคาร" },
        { value: "reports", label: "รายงานย้อนหลัง" },
        { value: "rooms", label: "จัดการห้องและผู้ดูแล" },
        { value: "users", label: "สิทธิ์ผู้ใช้" },
        { value: "settings", label: "ตั้งค่าระบบ" },
        { value: "audit", label: "Audit log" },
      ]}
    >
      {tab === "queue" && <QueueTab />}
      {tab === "grid" && <GridTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "rooms" && <RoomsAdminTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "audit" && <AuditLogTab />}
      {tab === "users" && <UsersAdminTab />}
    </ConsoleShell>
  );
}

/* ================= คิวอนุมัติ ================= */

function QueueTab() {
  const { db, actions, pending, today, nowIso } = useStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Booking[] | null>(null);
  const [reason, setReason] = useState("");
  const [floorFilter, setFloorFilter] = useState("all");
  const [onlyOutside, setOnlyOutside] = useState(false);

  const floors = listFloors(db, db.buildings[0]?.id ?? "");
  const all = pendingQueue(db);
  const queue = all
    .filter((b) => {
      if (floorFilter === "all") return true;
      const u = db.bookableUnits.find((x) => x.id === b.unitId);
      return u?.floorId === floorFilter;
    })
    .filter((b) => !onlyOutside || b.outsideHours);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const [actionError, setActionError] = useState<string | null>(null);

  const approve = async (ids: string[]) => {
    try {
      await actions.approveBookings(ids);
      setSelected([]);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "อนุมัติไม่สำเร็จ");
    }
  };

  const doReject = async () => {
    if (!rejectTarget) return;
    try {
      await actions.rejectBookings(rejectTarget.map((b) => b.id), reason);
      setRejectTarget(null);
      setReason("");
      setSelected([]);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ปฏิเสธไม่สำเร็จ");
    }
  };

  const nowMs = new Date(nowIso).getTime();
  const overdue = (b: Booking) =>
    (nowMs - new Date(b.createdAt).getTime()) / 3_600_000 > POLICY.pendingExpiryHours;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="คำขอรออนุมัติ" value={all.length} unit="รายการ" tone="amber" />
        <Stat label="ขอใช้นอกเวลา" value={all.filter((b) => b.outsideHours).length} unit="รายการ" tone="slate" />
        <Stat
          label="ค้างเกิน 48 ชม."
          value={all.filter(overdue).length}
          unit="รายการ"
          tone={all.filter(overdue).length ? "amber" : "slate"}
        />
      </div>

      <Card>
        <CardHeader
          icon={<IconShield className="h-4.5 w-4.5" />}
          title="คิวอนุมัติรวมทุกห้อง"
          subtitle="แอดมินเป็นผู้พิจารณาอนุมัติคำขอทั้งหมด"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <Select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
                  <option value="all">ทุกชั้น</option>
                  {floors.map((f) => <option key={f.id} value={f.id}>ชั้น {f.floorNo}</option>)}
                </Select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-600">
                <input
                  type="checkbox"
                  checked={onlyOutside}
                  onChange={(e) => setOnlyOutside(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                เฉพาะนอกเวลา
              </label>
            </div>
          }
        />

        {actionError && (
          <div className="mb-4"><Notice tone="error">{actionError}</Notice></div>
        )}

        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
            <p className="text-sm font-medium text-brand-900">เลือกไว้ {selected.length} รายการ</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>ล้างการเลือก</Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRejectTarget(queue.filter((b) => selected.includes(b.id)))}
              >
                <IconX className="h-3.5 w-3.5" /> ปฏิเสธที่เลือก
              </Button>
              <Button variant="success" size="sm" onClick={() => approve(selected)}>
                <IconCheck className="h-3.5 w-3.5" /> อนุมัติที่เลือก
              </Button>
            </div>
          </div>
        )}

        {queue.length === 0 ? (
          <EmptyState title="ไม่มีคำขอรออนุมัติ" description="คำขอใหม่จะมาแสดงที่นี่ทันทีที่ผู้ใช้ส่งเข้ามา" />
        ) : (
          <>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-ink-500">
              <input
                type="checkbox"
                checked={selected.length === queue.length}
                onChange={(e) => setSelected(e.target.checked ? queue.map((b) => b.id) : [])}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              เลือกทั้งหมดในหน้านี้ ({queue.length})
            </label>

            <ul className="space-y-3">
              {queue.map((b) => {
                const unit = db.bookableUnits.find((u) => u.id === b.unitId)!;
                const owner = db.users.find((u) => u.id === b.ownerId);
                const checked = selected.includes(b.id);
                const lead = Math.round((new Date(b.startAt).getTime() - nowMs) / 86_400_000);
                return (
                  <li
                    key={b.id}
                    className={cx(
                      "rounded-xl border p-4 transition",
                      checked ? "border-brand-400 bg-brand-50/50" : "border-ink-100 bg-white",
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(b.id)}
                        aria-label={`เลือกคำขอ ${b.publicTitle}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink-900">{b.publicTitle}</p>
                          <Badge className="bg-ink-50 text-ink-600 ring-ink-200">
                            {CATEGORY_META[b.category].label}
                          </Badge>
                          {b.outsideHours && (
                            <Badge className="bg-amber-50 text-amber-800 ring-amber-200" dot="bg-amber-500">
                              นอกเวลา · มีเอกสารแนบ
                            </Badge>
                          )}
                          {overdue(b) && (
                            <Badge className="bg-rose-50 text-rose-700 ring-rose-200" dot="bg-rose-500">
                              ค้างเกิน {POLICY.pendingExpiryHours} ชม.
                            </Badge>
                          )}
                          {unit.code.includes("-") && (
                            <Badge className="bg-violet-50 text-violet-700 ring-violet-200">ห้องรวม</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-ink-700">
                          {unit.name} <span className="text-ink-400">({unit.code})</span> ·{" "}
                          {thaiDateLong(dateKeyOf(b.startAt))} · {hhmmOf(b.startAt)}–{hhmmOf(b.endAt)} น.
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          {owner?.name} · {owner?.department} · {b.attendeeCount} คน · โทร {b.contactPhone}
                          {lead >= 0 && <> · ใช้ห้องอีก {lead} วัน</>}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-xs text-ink-500">{b.purpose}</p>
                      </div>
                      {/* บนมือถือปุ่มลงมาเต็มบรรทัดใต้เนื้อหา (ไม่บีบข้อความให้แคบ) · จอกว้างค่อยอยู่ข้าง ๆ */}
                      <div className="flex w-full flex-wrap gap-2 pl-7 sm:w-auto sm:shrink-0 sm:pl-0">
                        <Button variant="secondary" size="sm" onClick={() => setDetail(b)}>รายละเอียด</Button>
                        <Button variant="danger" size="sm" onClick={() => setRejectTarget([b])}>ปฏิเสธ</Button>
                        <Button variant="success" size="sm" onClick={() => approve([b.id])}>อนุมัติ</Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Notice tone="info" title="ทำไมคำขอที่รออนุมัติจึงกันเวลาไว้แล้ว">
          สถานะ <strong>รออนุมัติ</strong> กินที่ในตารางทันทีเพื่อไม่ให้ผู้อื่นจองซ้อนระหว่างรอ ·
          เมื่อปฏิเสธ ระบบจะคืนเวลานั้นให้ผู้อื่นจองได้ทันที
        </Notice>
      </Card>

      <BookingDetailModal
        booking={detail}
        onClose={() => setDetail(null)}
        footer={
          detail?.status === "PENDING" ? (
            <>
              <Button variant="danger" onClick={() => { setRejectTarget([detail]); setDetail(null); }}>
                ปฏิเสธคำขอ
              </Button>
              <Button variant="success" onClick={() => { approve([detail.id]); setDetail(null); }}>
                อนุมัติคำขอ
              </Button>
            </>
          ) : undefined
        }
      />

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={`ปฏิเสธคำขอ ${rejectTarget?.length ?? 0} รายการ`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>ยกเลิก</Button>
            <Button variant="danger" onClick={doReject} disabled={!reason.trim() || pending}>
              {pending ? "กำลังบันทึก…" : "ยืนยันการปฏิเสธ"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Notice tone="warn">
            การปฏิเสธต้องระบุเหตุผลเสมอ — เหตุผลนี้จะถูกส่งถึงผู้จองและบันทึกลง audit log
          </Notice>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-ink-100 p-3 text-sm">
            {rejectTarget?.map((b) => (
              <li key={b.id} className="text-ink-600">
                • {b.publicTitle} · {db.bookableUnits.find((u) => u.id === b.unitId)?.code} ·{" "}
                {thaiDateMedium(dateKeyOf(b.startAt))} {hhmmOf(b.startAt)}–{hhmmOf(b.endAt)}
              </li>
            ))}
          </ul>
          <Field label="เหตุผลที่ปฏิเสธ" required>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ห้องถูกใช้สำหรับงานของคณะในวันดังกล่าว · เอกสารประกอบไม่ครบ"
              className="min-h-24"
            />
          </Field>
          <p className="text-xs text-ink-400">วันที่อ้างอิง: {thaiDateMedium(today)}</p>
        </div>
      </Modal>
    </div>
  );
}

/* ================= ตารางรวมทั้งอาคาร ================= */

function GridTab() {
  const { db, today, nowIso } = useStore();
  const [dateKey, setDateKey] = useState(today);
  const [floorFilter, setFloorFilter] = useState("all");
  const [detail, setDetail] = useState<Booking | null>(null);

  const floors = listFloors(db, db.buildings[0]?.id ?? "");
  const units = listUnits(db, { floorId: floorFilter === "all" ? undefined : floorFilter });
  const rows = units.map((u) => ({ unit: u, entries: scheduleForDay(db, u.id, dateKey) }));
  const totalEntries = rows.reduce((s, r) => s + r.entries.length, 0);

  const open = (e: ScheduleEntry) => {
    const b = db.bookings.find((x) => x.id === e.bookingId);
    if (b) setDetail(b);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="ตารางเวลารวมทั้งอาคาร"
          subtitle={`${thaiDateLong(dateKey)} · ${totalEntries} รายการ · กดที่บล็อกเพื่อดูรายละเอียด`}
          action={
            <div className="flex flex-wrap gap-2">
              <div className="w-44">
                <Select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
                  <option value="all">ทุกชั้น</option>
                  {floors.map((f) => <option key={f.id} value={f.id}>ชั้น {f.floorNo}</option>)}
                </Select>
              </div>
              <Button variant="secondary" size="md" onClick={() => exportGridCsv(rows, dateKey)}>
                <IconDownload className="h-4 w-4" /> ส่งออก CSV
              </Button>
            </div>
          }
        />
        <div className="mb-4">
          <DateStrip value={dateKey} onChange={setDateKey} days={14} />
        </div>
        <RoomsGrid
          rows={rows}
          hours={displayHours({ open: "07:00", close: "20:00" }, rows.flatMap((r) => r.entries))}
          onEntryClick={open}
          nowMinutes={dateKey === today ? minutesOfDay(nowIso) : undefined}
        />
        <div className="mt-4 border-t border-ink-100 pt-3">
          <p className="mb-2 text-xs font-medium text-ink-500">
            คำอธิบายสี — แต่ละประเภทมีลวดลายและสัญลักษณ์กำกับ เพื่อให้อ่านได้แม้แยกสีไม่ได้
          </p>
          <CategoryLegend compact />
          <p className="mt-2 text-xs text-ink-400">
            บล็อกที่มีขอบขาวด้านในคือรายการที่ยัง <strong>รออนุมัติ</strong> ·
            แถวที่มีลายทแยงคือห้องที่ไม่เปิดให้จอง
          </p>
        </div>
      </Card>

      <BookingDetailModal booking={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* ================= รายงานย้อนหลัง ================= */

function ReportsTab() {
  const { db, today, actions, pending } = useStore();
  const [offset, setOffset] = useState(0);
  const monthStart = addMonths(startOfMonth(today), offset);
  const monthKey = monthStart.slice(0, 7);
  const stats = monthStats(db, monthKey);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [detail, setDetail] = useState<Booking | null>(null);

  const inMonth = db.bookings.filter((b) => dateKeyOf(b.startAt).startsWith(monthKey));
  const rejected = inMonth.filter((b) => b.status === "REJECTED");
  const outside = inMonth.filter((b) => b.outsideHours);
  const holidayUse = inMonth.filter((b) =>
    db.holidays.some((h) => h.date === dateKeyOf(b.startAt)),
  );
  const noShow = inMonth.filter((b) => b.status === "NO_SHOW");

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="รายงานรายเดือน"
          subtitle="ใช้ประกอบการตั้งค่าเทอมและการจัดสรรห้อง"
          action={
            <div className="flex gap-2">
              <div className="w-48">
                <Select value={String(offset)} onChange={(e) => setOffset(Number(e.target.value))}>
                  {[0, -1, -2, -3].map((o) => (
                    <option key={o} value={o}>{thaiMonthYear(addMonths(startOfMonth(today), o))}</option>
                  ))}
                </Select>
              </div>
              <Button variant="secondary" onClick={() => exportBookingsCsv(db, monthKey)}>
                <IconDownload className="h-4 w-4" /> ส่งออกทั้งเดือน
              </Button>
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="รายการที่ใช้งานจริง" value={stats.totalBookings} unit="รายการ" />
          <Stat label="ชั่วโมงรวม" value={stats.totalHours} unit="ชม." tone="emerald" />
          <Stat label="ถูกปฏิเสธ" value={rejected.length} unit="รายการ" tone="amber" />
          <Stat label="ใช้นอกเวลา" value={outside.length} unit="รายการ" tone="slate" />
          <Stat label="ใช้ในวันหยุด" value={holidayUse.length} unit="รายการ" tone="slate" />
          <Stat label="ไม่มาใช้ (NO_SHOW)" value={noShow.length} unit="รายการ" tone={noShow.length ? "amber" : "slate"} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="คำขอที่ถูกปฏิเสธและเหตุผล" />
          {rejected.length === 0 ? (
            <EmptyState title="ไม่มีคำขอที่ถูกปฏิเสธในเดือนนี้" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {rejected.map((b) => {
                const ap = approvalOf(db, b.id);
                return (
                  <li key={b.id} className="py-3">
                    <p className="text-sm font-medium text-ink-900">
                      {b.publicTitle} · {db.bookableUnits.find((u) => u.id === b.unitId)?.code}
                    </p>
                    <p className="text-xs text-ink-400">
                      {thaiDateMedium(dateKeyOf(b.startAt))} · {hhmmOf(b.startAt)}–{hhmmOf(b.endAt)} น.
                    </p>
                    <p className="mt-1 text-xs text-rose-700">เหตุผล: {ap?.reason || "ไม่ระบุ"}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="อัตราการใช้ห้องรายห้อง" />
          <ul className="space-y-3">
            {stats.perUnit.map((u) => (
              <li key={u.unitId}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink-700">{u.code}</span>
                  <span className="tabular-nums text-ink-500">{u.hours} ชม. · {u.count} รายการ</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.round(u.utilization * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <BookingListCard
        mode="upcoming"
        onDetail={setDetail}
        onCancel={setCancelTarget}
      />

      {/* กล่องแยกสำหรับเรื่องที่จบไปแล้ว — ประวัติการใช้ห้องจริง */}
      <BookingListCard mode="past" onDetail={setDetail} />

      <BookingDetailModal
        booking={detail}
        onClose={() => setDetail(null)}
        footer={
          detail?.status === "APPROVED" ? (
            <Button
              variant="danger"
              onClick={() => { setCancelTarget(detail); setDetail(null); }}
            >
              ยกเลิกการจอง
            </Button>
          ) : undefined
        }
      />

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="ยกเลิกการจองโดยแอดมิน"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>ปิด</Button>
            <Button
              variant="danger"
              disabled={!cancelReason.trim() || pending}
              onClick={async () => {
                if (!cancelTarget) return;
                await actions.cancelBooking(cancelTarget.id, true, cancelReason);
                setCancelTarget(null);
                setCancelReason("");
              }}
            >
              ยืนยันยกเลิก
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Notice tone="warn">
            การยกเลิกโดยแอดมินต้องระบุเหตุผล ระบบจะแจ้งผู้จองและบันทึกลง audit log
          </Notice>
          <Field label="เหตุผล" required>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-24"
              placeholder="เช่น ห้องถูกเรียกใช้สำหรับงานเร่งด่วนของคณะ"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ================= ตั้งค่าระบบ ================= */

function SettingsTab() {
  const { db } = useStore();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="นโยบายการจอง"
          subtitle="แหล่งความจริงเดียวของทั้งระบบ — ทุกหน้าจออ่านค่าจากที่นี่"
        />
        <dl className="divide-y divide-ink-100 text-sm">
          {[
            ["เขตเวลา", POLICY.timeZone],
            ["เวลาที่จองได้", `${POLICY.openTime} – ${POLICY.closeTime} น.`],
            ["หน่วยเวลาย่อย", `${POLICY.slotMinutes} นาที`],
            ["ความยาวขั้นต่ำ", `${POLICY.minDurationMinutes} นาที`],
            ["ความยาวสูงสุด", POLICY.maxDurationMinutes ? `${POLICY.maxDurationMinutes} นาที` : "ไม่จำกัด"],
            ["โควตาชั่วโมงต่อผู้ใช้", POLICY.userHourQuota ? `${POLICY.userHourQuota} ชม.` : "ไม่จำกัด"],
            ["จองล่วงหน้าอย่างน้อย", `${POLICY.leadTimeDays} วันปฏิทิน`],
            ["จองล่วงหน้าได้ไกลสุด", `${POLICY.bookingHorizonDays} วัน`],
            ["ยกเลิกล่วงหน้าอย่างน้อย", `${POLICY.cancelNoticeHours} ชั่วโมง`],
            ["คำขอหมดอายุใน", `${POLICY.pendingExpiryHours} ชั่วโมง`],
            ["ไฟล์แนบ", `${POLICY.attachment.acceptedTypes.join(" / ")} ≤ ${POLICY.attachment.maxSizeMb} MB`],
            ["ปกปิดกลุ่มสถิติที่เล็กกว่า", `${POLICY.statsMinGroupSize} รายการ`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-ink-500">{k}</dt>
              <dd className="text-right font-medium text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
        <Notice tone="warn" title="ยังแก้ผ่านหน้าจอไม่ได้">
          ค่าทั้งหมดอ่านมาจากตาราง app_settings ในฐานข้อมูลแล้ว แต่ยังไม่มีหน้าจอให้แก้ —
          แก้ผ่าน SQL ไปก่อน แล้วรีเฟรชหน้าเว็บ
        </Notice>
      </Card>

      <div className="space-y-5">
        <TermsCard />

        <Card>
          <CardHeader
            title="วันหยุด"
            subtitle="ใช้แสดงป้ายกำกับและเป็นตัวเลือกตอนจองทั้งเทอมเท่านั้น — ไม่บล็อกการจอง"
          />
          <ul className="divide-y divide-ink-100">
            {db.holidays.map((h) => (
              <li key={h.date} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-ink-700">{h.name}</span>
                <span className="tabular-nums text-ink-500">{thaiDateMedium(h.date)}</span>
              </li>
            ))}
          </ul>
          <Notice tone="info">
            ผู้ใช้จองห้องในวันหยุดและเสาร์–อาทิตย์ได้ตามปกติ ระบบเพียงแสดงป้ายกำกับให้ทราบ
          </Notice>
        </Card>

        <Card>
          <CardHeader title="ข้อกำหนดที่แสดงบนหน้าจอง" subtitle="ข้อความสร้างจากค่านโยบายข้างต้นโดยอัตโนมัติ" />
          <ul className="space-y-2 text-sm leading-relaxed text-ink-600">
            {bookingTerms().map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ================= ส่งออกไฟล์ ================= */

function exportGridCsv(
  rows: { unit: { code: string; name: string }; entries: ScheduleEntry[] }[],
  dateKey: string,
) {
  downloadCsv(`building-schedule-${dateKey}.csv`, [
    ["วันที่", "ห้อง", "ชื่อห้อง", "เริ่ม", "สิ้นสุด", "ชื่อเรื่อง", "ประเภท", "สถานะ"],
    ...rows.flatMap((r) =>
      r.entries.map((e) => [
        dateKey, r.unit.code, r.unit.name, hhmmOf(e.startAt), hhmmOf(e.endAt),
        e.publicTitle, CATEGORY_META[e.category].label,
        STATUS_META[e.status]?.label ?? e.status,
      ])),
  ]);
}

function exportBookingsCsv(db: ReturnType<typeof useStore>["db"], monthKey: string) {
  const inMonth = db.bookings.filter((b) => dateKeyOf(b.startAt).startsWith(monthKey));
  downloadCsv(`bookings-${monthKey}.csv`, [
    [
      "รหัส", "วันที่", "เริ่ม", "สิ้นสุด", "ห้อง", "ชื่อเรื่อง", "ประเภท",
      "ผู้จอง", "หน่วยงาน", "จำนวนคน", "สถานะ", "นอกเวลา", "เอกสารแนบ",
    ],
    ...inMonth.map((b) => {
      const owner = db.users.find((u) => u.id === b.ownerId);
      return [
        b.id, dateKeyOf(b.startAt), hhmmOf(b.startAt), hhmmOf(b.endAt),
        db.bookableUnits.find((u) => u.id === b.unitId)?.code ?? "",
        b.publicTitle, CATEGORY_META[b.category].label,
        owner?.name ?? "", owner?.department ?? "",
        b.attendeeCount, STATUS_META[b.status]?.label ?? b.status,
        b.outsideHours, b.attachmentName ?? "",
      ];
    }),
  ]);
}
