"use client";

/**
 * ตารางรายการจองของหน้าแอดมิน ใช้ซ้ำ 2 กล่อง (plan001.md §10)
 *
 *   mode="upcoming" — อนุมัติแล้วและกำลังจะถึง · ยกเลิกได้ (ต้องระบุเหตุผล)
 *   mode="past"     — ที่ผ่านมาแล้ว (ใช้จริง / ไม่มาใช้) · ดูอย่างเดียว
 *
 * เรื่องการส่งออก CSV
 * หน้าเว็บถือข้อมูลไว้แค่กรอบ ±ครึ่งปี และตารางแสดงแค่ 12 แถวแรกพอให้กวาดตา
 * ปุ่มส่งออกจึงยิง query ไปที่ฐานข้อมูลเอง — เลือกช่วงวันที่ได้ หรือเว้นว่างไว้
 * เพื่อเอา "ทั้งหมด" ตั้งแต่รายการแรกจนถึงรายการสุดท้าย
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_META, STATUS_META } from "@/lib/policy";
import { handoffOf } from "@/lib/repo";
import { downloadCsv } from "@/lib/csv";
import type { BookingScope } from "@/lib/db/admin-actions";
import type { Booking } from "@/lib/types";
import { dateKeyOf, hhmmOf, thaiDateMedium } from "@/lib/time";
import {
  Badge, Button, Card, CardHeader, EmptyState, Input, Notice,
} from "@/components/ui/primitives";
import { IconDownload } from "@/components/ui/icons";

const ROWS_SHOWN = 12;

export function BookingListCard({
  mode,
  onDetail,
  onCancel,
}: {
  mode: "upcoming" | "past";
  onDetail: (b: Booking) => void;
  onCancel?: (b: Booking) => void;
}) {
  const { db, today, actions } = useStore();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upcoming = mode === "upcoming";

  const list = db.bookings
    .filter((b) =>
      upcoming
        ? (b.status === "APPROVED" || b.status === "IN_USE") && dateKeyOf(b.startAt) >= today
        : ["COMPLETED", "NO_SHOW"].includes(b.status) || (b.status === "APPROVED" && dateKeyOf(b.startAt) < today))
    .sort((a, b) => (upcoming
      ? a.startAt.localeCompare(b.startAt)
      : b.startAt.localeCompare(a.startAt)));

  const shown = list.slice(0, ROWS_SHOWN);

  const exportCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      const scope: BookingScope = upcoming ? "UPCOMING" : "PAST";
      const data = await actions.exportBookings({ from: from || null, to: to || null, scope });
      if (!data.length) {
        setError("ไม่พบรายการในช่วงที่เลือก");
        return;
      }
      const range = from || to ? `${from || "เริ่มแรก"}_ถึง_${to || "ล่าสุด"}` : "ทั้งหมด";
      downloadCsv(`bookings-${upcoming ? "upcoming" : "past"}-${range}.csv`, [
        [
          "รหัส", "วันที่", "เริ่ม", "สิ้นสุด", "ชั่วโมง", "ห้อง", "ชื่อห้อง", "ชั้น",
          "ชื่อเรื่อง", "ประเภท", "สถานะ", "ผู้จอง", "อีเมล", "หน่วยงาน", "จำนวนคน",
          "เบอร์ติดต่อ", "นอกเวลา", "เอกสารแนบ", "มาจากตารางประจำเทอม",
          "ผู้อนุมัติ", "เหตุผลที่ปฏิเสธ", "ผู้ดูแลห้องที่รับเรื่อง", "รับเรื่องแล้ว", "ยื่นคำขอเมื่อ",
        ],
        ...data.map((r) => [
          r.id, r.date, r.startTime, r.endTime, r.hours, r.room, r.roomName, r.floor,
          r.title, CATEGORY_META[r.category as keyof typeof CATEGORY_META]?.label ?? r.category,
          STATUS_META[r.status as keyof typeof STATUS_META]?.label ?? r.status,
          r.owner, r.ownerEmail, r.department, r.attendees, r.contactPhone,
          r.outsideHours, r.attachmentName, r.fromSeries,
          r.approvedBy, r.rejectReason, r.handledBy, r.acknowledged, r.createdAt,
        ]),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={upcoming ? "รายการที่อนุมัติแล้วและกำลังจะถึง" : "รายการที่ผ่านมาแล้ว"}
        subtitle={
          upcoming
            ? "กดที่ชื่อเรื่องเพื่อดูรายละเอียด · แอดมินยกเลิกได้ (ต้องระบุเหตุผล)"
            : "ประวัติการใช้ห้องที่จบไปแล้ว ทั้งที่ใช้จริงและที่ไม่มาใช้ (NO_SHOW)"
        }
        action={
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-ink-400">
              ตั้งแต่
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 h-9 w-40 text-sm"
                aria-label="ส่งออกตั้งแต่วันที่"
              />
            </label>
            <label className="text-xs text-ink-400">
              ถึง
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 h-9 w-40 text-sm"
                aria-label="ส่งออกถึงวันที่"
              />
            </label>
            <Button variant="secondary" disabled={busy} onClick={exportCsv}>
              <IconDownload className="h-4 w-4" />
              {busy ? "กำลังรวบรวม…" : from || to ? "ส่งออกช่วงที่เลือก" : "ส่งออกทั้งหมด"}
            </Button>
          </div>
        }
      />

      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}

      {shown.length === 0 ? (
        <EmptyState
          title={upcoming ? "ยังไม่มีรายการที่อนุมัติแล้วในอนาคต" : "ยังไม่มีประวัติการใช้ห้อง"}
          description={
            upcoming
              ? "คำขอที่อนุมัติแล้วจะมาแสดงที่นี่"
              : "รายการที่ใช้ห้องเสร็จแล้วจะย้ายมาอยู่กล่องนี้เอง"
          }
        />
      ) : (
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
                <th className="py-2 font-medium">วันที่</th>
                <th className="py-2 font-medium">เวลา</th>
                <th className="py-2 font-medium">ห้อง</th>
                <th className="py-2 font-medium">ชื่อเรื่อง</th>
                <th className="py-2 font-medium">ผู้จอง</th>
                <th className="py-2 font-medium">{upcoming ? "ผู้ดูแลรับเรื่อง" : "ผลการใช้งาน"}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map((b) => {
                const h = handoffOf(db, b.id);
                const unit = db.bookableUnits.find((u) => u.id === b.unitId);
                const meta = STATUS_META[b.status];
                return (
                  <tr key={b.id}>
                    <td className="py-2.5 text-ink-700">{thaiDateMedium(dateKeyOf(b.startAt))}</td>
                    <td className="py-2.5 tabular-nums text-ink-700">
                      {hhmmOf(b.startAt)}–{hhmmOf(b.endAt)}
                    </td>
                    <td className="py-2.5 text-ink-700">{unit?.code}</td>
                    <td className="py-2.5">
                      <button
                        onClick={() => onDetail(b)}
                        className="text-left font-medium text-ink-900 hover:text-brand-700 hover:underline"
                      >
                        {b.publicTitle}
                      </button>
                    </td>
                    <td className="py-2.5 text-ink-500">
                      {db.users.find((u) => u.id === b.ownerId)?.name}
                    </td>
                    <td className="py-2.5">
                      {upcoming ? (
                        h?.acknowledgedAt ? (
                          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200" dot="bg-emerald-500">
                            รับแล้ว
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-800 ring-amber-200" dot="bg-amber-500">
                            รอรับ
                          </Badge>
                        )
                      ) : (
                        <Badge className={meta.className} dot={meta.dot}>{meta.label}</Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" size="sm" onClick={() => onDetail(b)}>
                          รายละเอียด
                        </Button>
                        {upcoming && onCancel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50"
                            onClick={() => onCancel(b)}
                          >
                            ยกเลิก
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink-400">
        แสดง {shown.length} จาก {list.length} รายการที่หน้าจอโหลดไว้
        {!upcoming && " (ย้อนหลัง 90 วันล่าสุด)"} ·
        ปุ่มส่งออก CSV ดึงจากฐานข้อมูลโดยตรง จึงได้ครบทุกรายการแม้จะเก่ากว่านั้น
        {" "}เว้นช่องวันที่ว่างไว้ = เอาทั้งหมด
      </p>
    </Card>
  );
}
