"use client";

/**
 * Audit log — บันทึกเบื้องหลังของทุกการเปลี่ยนแปลง (plan001.md §10, §11.2)
 *
 * แต่ละรายการเก็บ 3 ชั้น:
 *   summary  ประโยคที่คนอ่านรู้เรื่องทันที
 *   after    รายละเอียดเชิงโครงสร้างของรายการนั้น (กด "ดูรายละเอียด" จึงจะเห็น)
 *   before   ค่าก่อนแก้ไข เฉพาะรายการที่เป็นการแก้ข้อมูล
 *
 * รายการที่เห็นมาจากก้อน Db ที่โหลดไว้ (200 รายการล่าสุด) แล้วกรองในเบราว์เซอร์
 * ส่วนปุ่ม "ค้นจากฐานข้อมูล" และการส่งออก CSV ยิง query จริงตามตัวกรอง
 * จึงย้อนหลังได้ไกลกว่าที่หน้าจอถืออยู่
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { POLICY } from "@/lib/policy";
import { downloadCsv } from "@/lib/csv";
import type { AuditRow } from "@/lib/db/admin-actions";
import type { AuditLog } from "@/lib/types";
import { thaiDateMedium } from "@/lib/time";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, Notice, Select, cx,
} from "@/components/ui/primitives";
import { IconDownload, IconSearch } from "@/components/ui/icons";

/* ---------------- คำแปลสำหรับแสดงผล ---------------- */

const ACTION_LABEL: Record<string, string> = {
  BOOKING_CREATED: "ส่งคำขอจอง",
  BOOKING_APPROVED: "อนุมัติคำขอ",
  BOOKING_REJECTED: "ปฏิเสธคำขอ",
  BOOKING_CANCELLED: "ยกเลิกการจอง",
  HANDOFF_ACK: "ผู้ดูแลห้องรับเรื่อง",
  ISSUE_REPORTED: "แจ้งปัญหา",
  BLACKOUT_CREATED: "บล็อกเวลาห้อง",
  BLACKOUT_REMOVED: "ยกเลิกการบล็อกเวลา",
  UNIT_CREATED: "เพิ่มห้องใหม่",
  UNIT_UPDATED: "แก้ไขข้อมูลห้อง",
  BUILDING_CREATED: "เพิ่มอาคารใหม่",
  MANAGER_ASSIGNED: "แต่งตั้งผู้ดูแลห้อง",
  MANAGER_REMOVED: "ถอดผู้ดูแลห้อง",
  ROLE_GRANTED: "ให้สิทธิ์ผู้ใช้",
  ROLE_REVOKED: "ถอดสิทธิ์ผู้ใช้",
  SERIES_CREATED: "สร้างตารางประจำเทอม",
  SERIES_DELETED: "ลบตารางประจำเทอม",
  TERM_CREATED: "เพิ่มภาคการศึกษา",
  TERM_UPDATED: "แก้ไขภาคการศึกษา",
  TERM_DELETED: "ลบภาคการศึกษา",
};

const ENTITY_LABEL: Record<string, string> = {
  booking: "การจอง",
  bookableUnit: "ห้อง",
  building: "อาคาร",
  blackout: "การบล็อกเวลา",
  bookingSeries: "ตารางประจำเทอม",
  handoff: "การส่งต่อ",
  user: "ผู้ใช้",
  term: "ภาคการศึกษา",
};

const FIELD_LABEL: Record<string, string> = {
  room: "ห้อง",
  roomName: "ชื่อห้อง",
  title: "ชื่อเรื่อง",
  date: "วันที่ใช้ห้อง",
  time: "เวลา",
  owner: "ผู้จอง",
  ownerEmail: "อีเมลผู้จอง",
  department: "หน่วยงาน",
  category: "ประเภทการใช้งาน",
  attendees: "จำนวนผู้เข้าร่วม",
  contactPhone: "เบอร์ติดต่อ",
  outsideHours: "ใช้นอกเวลาให้บริการ",
  status: "สถานะหลังทำรายการ",
  attachmentName: "เอกสารแนบ",
  reason: "เหตุผล",
  handedToName: "ส่งต่อให้ผู้ดูแลห้อง",
  cancelledBy: "ยกเลิกโดย",
  note: "หมายเหตุ",
  issue: "ปัญหาที่แจ้ง",
  startAt: "เริ่ม",
  endAt: "สิ้นสุด",
  weekdays: "วันในสัปดาห์",
  range: "ช่วงวันที่",
  exclusions: "ช่วงที่เว้น",
  skipHolidays: "ข้ามวันหยุด",
  created: "จองสำเร็จ (ครั้ง)",
  skipped: "เว้นตามที่กำหนด (ครั้ง)",
  conflicts: "ชนกับรายการเดิม",
  removedFutureBookings: "คืนเวลาที่ยังไม่ถึง (ครั้ง)",
  managerName: "ชื่อผู้ดูแล",
  managerEmail: "อีเมลผู้ดูแล",
  accountCreated: "สร้างบัญชีใหม่ให้",
  roleRevoked: "ถอดสิทธิ์ผู้ดูแลห้องออกด้วย",
  role: "สิทธิ์",
  granted: "เป็นการให้สิทธิ์",
  userName: "ผู้ใช้",
  userEmail: "อีเมลผู้ใช้",
  code: "รหัส",
  name: "ชื่อ",
  floors: "ชั้น",
  roomType: "ประเภทห้อง",
  capacity: "ความจุ",
  isBookable: "เปิดให้จอง",
  openToGuest: "บุคคลภายนอกจองได้",
  spaceMode: "วิธีผูกพื้นที่",
  spaceCount: "จำนวนพื้นที่ที่กิน",
  description: "คำอธิบายห้อง",
  contactNote: "ข้อความถึงผู้จอง",
  openTime: "เวลาเปิด",
  closeTime: "เวลาปิด",
  unbookableReason: "เหตุผลที่ปิดห้อง",
  startDate: "วันเริ่ม",
  endDate: "วันสิ้นสุด",
};

/** id ภายในไม่มีความหมายกับคนอ่าน — ซ่อนออกจากรายละเอียด */
const HIDDEN_FIELDS = new Set(["handedTo", "bookingId", "equipmentIds"]);

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่";
  if (Array.isArray(value)) return value.length ? value.map(valueText).join(" · ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function entriesOf(detail: Record<string, unknown> | null): [string, unknown][] {
  if (!detail) return [];
  return Object.entries(detail).filter(([k]) => !HIDDEN_FIELDS.has(k));
}

const detailText = (detail: Record<string, unknown> | null) =>
  entriesOf(detail).map(([k, v]) => `${FIELD_LABEL[k] ?? k}: ${valueText(v)}`).join(" | ");

const fullTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    timeZone: POLICY.timeZone,
    dateStyle: "medium",
    timeStyle: "medium",
  });

/** แปลงรายการจากก้อน Db ให้รูปทรงเดียวกับผลที่ยิง query เอง จะได้แสดงด้วยโค้ดชุดเดียว */
function fromDb(log: AuditLog, name: string, email: string): AuditRow {
  return {
    id: log.id,
    at: log.at,
    actorId: log.actorId,
    actorName: name,
    actorEmail: email,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    summary: log.summary,
    detail: log.detail,
    before: log.before,
  };
}

/* ---------------- หน้าจอ ---------------- */

export function AuditLogTab() {
  const { db, actions, today } = useStore();

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [actorId, setActorId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  /** ผลที่ยิง query เองตามตัวกรอง — null = ใช้รายการล่าสุดจากก้อน Db */
  const [serverRows, setServerRows] = useState<AuditRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownActions = Array.from(new Set(db.auditLogs.map((l) => l.action))).sort();

  const filter = {
    from: from || null,
    to: to || null,
    action: action === "all" ? null : action,
    actorId: actorId === "all" ? null : actorId,
    search: search.trim() || null,
  };

  const localRows = db.auditLogs
    .map((l) => {
      const u = db.users.find((x) => x.id === l.actorId);
      return fromDb(l, u?.name ?? "ระบบ", u?.email ?? "");
    })
    .filter((r) => {
      const day = r.at.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (action !== "all" && r.action !== action) return false;
      if (actorId !== "all" && r.actorId !== actorId) return false;
      const q = search.trim().toLowerCase();
      if (q && !`${r.summary} ${r.actorName}`.toLowerCase().includes(q)) return false;
      return true;
    });

  const rows = serverRows ?? localRows;

  const runServerQuery = async () => {
    setBusy(true);
    setError(null);
    try {
      setServerRows(await actions.fetchAuditLogs(filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await actions.fetchAuditLogs(filter);
      downloadCsv(`audit-log-${today}.csv`, [
        [
          "เวลา", "ผู้ทำรายการ", "อีเมล", "การกระทำ", "รหัสการกระทำ",
          "ประเภทข้อมูล", "รหัสข้อมูล", "สรุป", "รายละเอียด", "ค่าเดิม",
        ],
        ...data.map((r) => [
          fullTime(r.at),
          r.actorName,
          r.actorEmail,
          ACTION_LABEL[r.action] ?? r.action,
          r.action,
          ENTITY_LABEL[r.entity] ?? r.entity,
          r.entityId,
          r.summary,
          detailText(r.detail),
          detailText(r.before),
        ]),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setAction("all");
    setActorId("all");
    setFrom("");
    setTo("");
    setServerRows(null);
  };

  /** ตัวกรองเปลี่ยนเมื่อไหร่ ผลที่ค้างจากฐานข้อมูลก็ไม่ตรงแล้ว จึงล้างทิ้ง */
  const onFilterChange = <T,>(set: (v: T) => void) => (value: T) => {
    set(value);
    setServerRows(null);
  };

  return (
    <Card>
      <CardHeader
        title="Audit log"
        subtitle="บันทึกแบบเพิ่มอย่างเดียว — กดที่รายการเพื่อดูรายละเอียดทั้งหมดของการเปลี่ยนแปลง"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={runServerQuery}>
              <IconSearch className="h-4 w-4" /> ค้นจากฐานข้อมูล
            </Button>
            <Button variant="secondary" disabled={busy} onClick={exportCsv}>
              <IconDownload className="h-4 w-4" /> ส่งออก CSV
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="ค้นหา">
          <Input
            value={search}
            onChange={(e) => onFilterChange(setSearch)(e.target.value)}
            placeholder="ข้อความในสรุป หรือชื่อผู้ทำรายการ"
          />
        </Field>
        <Field label="การกระทำ">
          <Select value={action} onChange={(e) => onFilterChange(setAction)(e.target.value)}>
            <option value="all">ทุกการกระทำ</option>
            {knownActions.map((a) => (
              <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>
            ))}
          </Select>
        </Field>
        <Field label="ผู้ทำรายการ">
          <Select value={actorId} onChange={(e) => onFilterChange(setActorId)(e.target.value)}>
            <option value="all">ทุกคน</option>
            {db.users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="ตั้งแต่วันที่">
          <Input
            type="date"
            value={from}
            onChange={(e) => onFilterChange(setFrom)(e.target.value)}
          />
        </Field>
        <Field label="ถึงวันที่">
          <Input
            type="date"
            value={to}
            onChange={(e) => onFilterChange(setTo)(e.target.value)}
          />
        </Field>
      </div>

      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-ink-500">
          แสดง <strong className="text-ink-900">{rows.length}</strong> รายการ
          {serverRows
            ? " · ผลค้นจากฐานข้อมูลตามตัวกรองทั้งหมด"
            : ` · กรองจาก ${db.auditLogs.length} รายการล่าสุดที่โหลดไว้`}
        </p>
        <Button variant="ghost" size="sm" onClick={clearFilters}>ล้างตัวกรอง</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="ไม่พบรายการตามเงื่อนไข"
          description="ลองล้างตัวกรอง หรือกด “ค้นจากฐานข้อมูล” เพื่อย้อนหลังให้ไกลขึ้น"
        />
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((r) => {
            const open = openId === r.id;
            const detail = entriesOf(r.detail);
            const before = entriesOf(r.before);
            return (
              <li key={r.id}>
                <button
                  onClick={() => setOpenId(open ? null : r.id)}
                  aria-expanded={open}
                  className="flex w-full flex-wrap items-start gap-3 rounded-lg py-3 text-left transition hover:bg-ink-50/70"
                >
                  <Badge className="bg-ink-50 text-ink-600 ring-ink-200">
                    {ACTION_LABEL[r.action] ?? r.action}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-900">{r.summary}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {r.actorName || "ระบบ"} · {ENTITY_LABEL[r.entity] ?? r.entity} · {fullTime(r.at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-brand-700">
                    {open ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                  </span>
                </button>

                {open && (
                  <div className="mb-3 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      <DetailRow
                        label="ผู้ทำรายการ"
                        value={r.actorEmail ? `${r.actorName} · ${r.actorEmail}` : r.actorName}
                      />
                      <DetailRow label="เวลาที่บันทึก" value={fullTime(r.at)} />
                      <DetailRow label="ประเภทข้อมูล" value={ENTITY_LABEL[r.entity] ?? r.entity} />
                      <DetailRow label="รหัสข้อมูล" value={r.entityId} mono />
                      {detail.map(([k, v]) => (
                        <DetailRow key={k} label={FIELD_LABEL[k] ?? k} value={valueText(v)} />
                      ))}
                    </dl>

                    {before.length > 0 && (
                      <div className="mt-3 border-t border-ink-200 pt-3">
                        <p className="mb-1.5 text-xs font-medium text-ink-500">ค่าก่อนแก้ไข</p>
                        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                          {before.map(([k, v]) => (
                            <DetailRow key={k} label={FIELD_LABEL[k] ?? k} value={valueText(v)} />
                          ))}
                        </dl>
                      </div>
                    )}

                    {detail.length === 0 && before.length === 0 && (
                      <p className="mt-2 text-xs text-ink-400">
                        รายการนี้ถูกบันทึกก่อนระบบเก็บรายละเอียดเชิงโครงสร้าง จึงมีเพียงข้อความสรุป
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Notice tone="info">
        บันทึกลงตาราง audit_logs ในฐานข้อมูลจริง และมี trigger กันไม่ให้แก้ไขหรือลบ
        (append-only ตาม §11.2) · เวลาทั้งหมดเป็นเวลาไทย · วันนี้คือ {thaiDateMedium(today)}
      </Notice>
    </Card>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100/70 pb-1.5">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className={cx("text-right text-sm break-words text-ink-800", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}
