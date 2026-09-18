"use client";

/**
 * การจองของฉัน (plan001.md §8.5)
 * แท็บ: รออนุมัติ / อนุมัติแล้ว / ที่ผ่านมา / ถูกยกเลิก
 */

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_META, POLICY, STATUS_META } from "@/lib/policy";
import {
  approvalOf, bookingsOfUser, getUnit,
} from "@/lib/repo";
import type { Booking } from "@/lib/types";
import { durationLabel, hhmmOf, thaiDateLong } from "@/lib/time";
import { PageShell, PageHeading } from "@/components/layout/SiteShell";
import {
  Badge, Button, ButtonLink, Card, EmptyState, Modal, Notice, Tabs, Textarea,
} from "@/components/ui/primitives";
import {
  IconBan, IconClock, IconDownload, IconDoc, IconUsers, IconWarn,
} from "@/components/ui/icons";

type TabKey = "PENDING" | "APPROVED" | "PAST" | "CANCELLED";

export default function MyBookingsPage() {
  const { db, viewer, actions, pending, nowIso } = useStore();
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const all = useMemo(() => (viewer ? bookingsOfUser(db, viewer.id) : []), [db, viewer]);

  const groups: Record<TabKey, Booking[]> = {
    PENDING: all.filter((b) => b.status === "PENDING"),
    APPROVED: all.filter((b) => b.status === "APPROVED" || b.status === "IN_USE"),
    PAST: all.filter((b) => b.status === "COMPLETED" || b.status === "NO_SHOW"),
    CANCELLED: all.filter((b) =>
      ["REJECTED", "CANCELLED_BY_USER", "CANCELLED_BY_ADMIN"].includes(b.status),
    ),
  };

  const canCancel = (b: Booking) => {
    const hoursLeft = (new Date(b.startAt).getTime() - new Date(nowIso).getTime()) / 3_600_000;
    if (b.status === "PENDING") return true;
    if (b.status !== "APPROVED") return false;
    return hoursLeft >= POLICY.cancelNoticeHours;
  };

  const [cancelError, setCancelError] = useState<string | null>(null);

  const doCancel = async () => {
    if (!cancelTarget) return;
    try {
      await actions.cancelBooking(cancelTarget.id, false, cancelReason);
      setCancelTarget(null);
      setCancelReason("");
      setCancelError(null);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  };

  if (!viewer) {
    return (
      <PageShell>
        <PageHeading title="การจองของฉัน" description="ดูสถานะคำขอ ยกเลิก และเพิ่มลงปฏิทินได้ที่นี่" />
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <EmptyState
            title="กรุณาเข้าสู่ระบบก่อน"
            description="กดปุ่มบัญชีมุมขวาบนเพื่อเลือกผู้ใช้ทดลอง แล้วกลับมาที่หน้านี้อีกครั้ง"
            action={<ButtonLink href="/">กลับหน้าแรก</ButtonLink>}
          />
        </div>
      </PageShell>
    );
  }

  const list = groups[tab];

  return (
    <PageShell>
      <PageHeading
        eyebrow={viewer.department}
        title="การจองของฉัน"
        description={`ทั้งหมด ${all.length} รายการ · ยกเลิกได้ล่วงหน้าอย่างน้อย ${POLICY.cancelNoticeHours} ชั่วโมงก่อนเวลาเริ่ม`}
        action={<ButtonLink href="/book">จองห้องเพิ่ม</ButtonLink>}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "PENDING", label: "รออนุมัติ", count: groups.PENDING.length },
            { value: "APPROVED", label: "อนุมัติแล้ว", count: groups.APPROVED.length },
            { value: "PAST", label: "ที่ผ่านมา", count: groups.PAST.length },
            { value: "CANCELLED", label: "ยกเลิก/ปฏิเสธ", count: groups.CANCELLED.length },
          ]}
        />

        <div className="mt-5 space-y-4">
          {list.length === 0 ? (
            <EmptyState
              title="ยังไม่มีรายการในกลุ่มนี้"
              description={tab === "PENDING" ? "คำขอที่ส่งใหม่จะมาแสดงที่นี่" : undefined}
              action={tab === "PENDING" ? <ButtonLink href="/book" size="sm">เริ่มจองห้อง</ButtonLink> : undefined}
            />
          ) : (
            list.map((b) => {
              const unit = getUnit(db, b.unitId)!;
              const meta = STATUS_META[b.status];
              const approval = approvalOf(db, b.id);

              return (
                <Card key={b.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-ink-900">{b.publicTitle}</h3>
                        <Badge className={meta.className} dot={meta.dot}>{meta.label}</Badge>
                        <Badge className="bg-ink-50 text-ink-600 ring-ink-200">
                          {CATEGORY_META[b.category].label}
                        </Badge>
                        {b.outsideHours && (
                          <Badge className="bg-amber-50 text-amber-800 ring-amber-200" dot="bg-amber-500">
                            นอกเวลาให้บริการ
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-ink-700">
                        {unit.name} <span className="text-ink-400">({unit.code})</span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
                        <span>{thaiDateLong(b.startAt.slice(0, 10))}</span>
                        <span className="flex items-center gap-1.5">
                          <IconClock className="h-4 w-4 text-ink-400" />
                          {hhmmOf(b.startAt)}–{hhmmOf(b.endAt)} น. · {durationLabel(b.startAt, b.endAt)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconUsers className="h-4 w-4 text-ink-400" />{b.attendeeCount} คน
                        </span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <ButtonLink href={`/rooms/${unit.code}`} variant="secondary" size="sm">ดูห้อง</ButtonLink>
                      <Button variant="secondary" size="sm" onClick={() => downloadIcs(b, unit.name)}>
                        <IconDownload className="h-3.5 w-3.5" /> เพิ่มลงปฏิทิน
                      </Button>
                      {canCancel(b) && (
                        <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => setCancelTarget(b)}>
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  </div>

                  {b.status === "REJECTED" && approval && (
                    <div className="mt-4">
                      <Notice tone="error" title="เหตุผลที่ถูกปฏิเสธ">{approval.reason || "ไม่ระบุเหตุผล"}</Notice>
                    </div>
                  )}

                  {b.status === "PENDING" && (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                      <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      คำขอนี้กันเวลาไว้ให้แล้ว ผู้อื่นจองซ้อนไม่ได้ระหว่างรอ ·
                      แอดมินจะพิจารณาภายใน {POLICY.pendingExpiryHours} ชั่วโมง
                    </p>
                  )}


                  {(b.purpose || b.attachmentName || b.note) && (
                    <dl className="mt-4 grid gap-2 border-t border-ink-100 pt-3 text-xs sm:grid-cols-3">
                      {b.purpose && (
                        <div>
                          <dt className="text-ink-400">วัตถุประสงค์</dt>
                          <dd className="mt-0.5 text-ink-700">{b.purpose}</dd>
                        </div>
                      )}
                      {b.attachmentName && (
                        <div>
                          <dt className="text-ink-400">เอกสารแนบ</dt>
                          <dd className="mt-0.5 flex items-center gap-1 text-ink-700">
                            <IconDoc className="h-3.5 w-3.5" />{b.attachmentName}
                          </dd>
                        </div>
                      )}
                      {b.note && (
                        <div>
                          <dt className="text-ink-400">หมายเหตุ</dt>
                          <dd className="mt-0.5 text-ink-700">{b.note}</dd>
                        </div>
                      )}
                    </dl>
                  )}

                  {b.status === "APPROVED" && !canCancel(b) && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
                      <IconBan className="h-3.5 w-3.5" />
                      เลยกำหนดยกเลิกออนไลน์แล้ว ({POLICY.cancelNoticeHours} ชม. ก่อนเริ่ม) — กรุณาติดต่อแอดมิน
                    </p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="ยืนยันการยกเลิกการจอง"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>ไม่ยกเลิก</Button>
            <Button variant="danger" onClick={doCancel} disabled={pending}>
              {pending ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
            </Button>
          </>
        }
      >
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-600">
              คุณกำลังจะยกเลิก <strong>{cancelTarget.publicTitle}</strong> ที่{" "}
              {getUnit(db, cancelTarget.unitId)?.name} วันที่{" "}
              {thaiDateLong(cancelTarget.startAt.slice(0, 10))} เวลา{" "}
              {hhmmOf(cancelTarget.startAt)}–{hhmmOf(cancelTarget.endAt)} น.
            </p>
            <Notice tone="warn">
              เมื่อยกเลิกแล้ว เวลานี้จะถูกปล่อยให้ผู้อื่นจองได้ทันที และไม่สามารถกู้คืนได้
            </Notice>
            {cancelError && <Notice tone="error">{cancelError}</Notice>}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">เหตุผลการยกเลิก (ไม่บังคับ)</span>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="เช่น เปลี่ยนไปใช้ห้องอื่น · เลื่อนการประชุม"
                className="min-h-20"
              />
            </label>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

/** สร้างไฟล์ .ics ให้เพิ่มลงปฏิทินส่วนตัวได้ */
function downloadIcs(b: Booking, roomName: string) {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DS Room Booking//TH",
    "BEGIN:VEVENT",
    `UID:${b.id}@dsroombooking`,
    `DTSTAMP:${fmt(b.createdAt)}`,
    `DTSTART:${fmt(b.startAt)}`,
    `DTEND:${fmt(b.endAt)}`,
    `SUMMARY:${b.publicTitle} (${roomName})`,
    `LOCATION:${roomName} อาคาร SCB4`,
    `DESCRIPTION:${b.purpose.replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking-${b.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
