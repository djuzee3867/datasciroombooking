"use client";

/** รายละเอียดการจองแบบเต็ม — ใช้ร่วมกันในหน้าผู้ดูแลห้องและหน้าแอดมิน */

import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_META, STATUS_META } from "@/lib/policy";
import { approvalOf, handoffOf } from "@/lib/repo";
import type { Booking } from "@/lib/types";
import { durationLabel, hhmmOf, thaiDateLong } from "@/lib/time";
import { Badge, Modal, Notice } from "@/components/ui/primitives";
import { AttachmentCard } from "@/components/AttachmentPreview";

export function BookingDetailModal({
  booking,
  onClose,
  footer,
}: {
  booking: Booking | null;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const { db } = useStore();
  if (!booking) return null;

  const unit = db.bookableUnits.find((u) => u.id === booking.unitId);
  const owner = db.users.find((u) => u.id === booking.ownerId);
  const meta = STATUS_META[booking.status];
  const approval = approvalOf(db, booking.id);
  const handoff = handoffOf(db, booking.id);
  const manager = handoff?.roomManagerId
    ? db.users.find((u) => u.id === handoff.roomManagerId)
    : null;

  return (
    <Modal open onClose={onClose} title="รายละเอียดการจอง" wide footer={footer}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-lg font-semibold text-ink-900">{booking.publicTitle}</h4>
          <Badge className={meta.className} dot={meta.dot}>{meta.label}</Badge>
          <Badge className="bg-ink-50 text-ink-600 ring-ink-200">
            {CATEGORY_META[booking.category].label}
          </Badge>
          {booking.outsideHours && (
            <Badge className="bg-amber-50 text-amber-800 ring-amber-200" dot="bg-amber-500">
              นอกเวลาให้บริการ
            </Badge>
          )}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["ห้อง", `${unit?.name ?? "-"} (${unit?.code ?? "-"})`],
            ["วันที่", thaiDateLong(booking.startAt.slice(0, 10))],
            [
              "เวลา",
              `${hhmmOf(booking.startAt)}–${hhmmOf(booking.endAt)} น. · ${durationLabel(booking.startAt, booking.endAt)}`,
            ],
            ["ผู้จอง", `${owner?.name ?? "-"}`],
            ["หน่วยงาน", owner?.department ?? "-"],
            ["เบอร์ติดต่อ", booking.contactPhone],
            ["อีเมล", owner?.email ?? "-"],
            ["จำนวนผู้เข้าร่วม", `${booking.attendeeCount} คน`],
            ["ยื่นคำขอเมื่อ", thaiDateLong(booking.createdAt.slice(0, 10))],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-ink-100 p-3">
              <dt className="text-xs text-ink-400">{k}</dt>
              <dd className="mt-0.5 text-sm font-medium break-words text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>

        <AttachmentCard booking={booking} />

        <div className="rounded-xl border border-ink-100 p-3">
          <p className="text-xs text-ink-400">วัตถุประสงค์การใช้งาน</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-800">{booking.purpose || "ไม่ระบุ"}</p>
        </div>

        {booking.note && (
          <div className="rounded-xl border border-ink-100 p-3">
            <p className="text-xs text-ink-400">หมายเหตุจากผู้จอง</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-800">{booking.note}</p>
          </div>
        )}

        {approval && (
          <div className="rounded-xl border border-ink-100 p-3">
            <p className="text-xs text-ink-400">
              ผลการพิจารณา ({approval.decision === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ"})
            </p>
            <p className="mt-1 text-sm text-ink-800">
              โดย {db.users.find((u) => u.id === approval.decidedBy)?.name ?? approval.decidedBy}
              {approval.reason && ` — ${approval.reason}`}
            </p>
          </div>
        )}

        {handoff && (
          <div className="rounded-xl border border-ink-100 p-3">
            <p className="text-xs text-ink-400">การส่งต่อให้ผู้ดูแลห้อง</p>
            <p className="mt-1 text-sm text-ink-800">
              {manager ? `ส่งให้ ${manager.name}` : "ยังไม่มีผู้ดูแลห้องที่ผูกกับห้องนี้"}
              {handoff.acknowledgedAt ? " · รับเรื่องแล้ว" : " · รอรับเรื่อง"}
              {handoff.note && ` — “${handoff.note}”`}
            </p>
          </div>
        )}

        <Notice tone="info">
          ข้อมูลผู้จอง เบอร์ติดต่อ และวัตถุประสงค์ เป็นข้อมูลภายใน —
          ผู้ที่ไม่ล็อกอินจะเห็นเฉพาะช่วงเวลาและชื่อเรื่อง “{booking.publicTitle}” เท่านั้น
        </Notice>
      </div>
    </Modal>
  );
}
