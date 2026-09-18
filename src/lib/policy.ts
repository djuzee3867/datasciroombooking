/**
 * นโยบายของระบบ — แหล่งความจริงเดียว (plan001.md §3)
 *
 * ทุกหน้าจอต้องอ่านค่าจากไฟล์นี้ ห้าม hardcode ตัวเลขซ้ำในแต่ละหน้า
 * ของจริงค่าเหล่านี้จะย้ายไปเป็นตารางตั้งค่าที่ ADMIN แก้ได้
 */

import type { BookingCategory } from "./types";

export interface Policy {
  timeZone: string;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number | null;
  leadTimeDays: number;
  bookingHorizonDays: number;
  cancelNoticeHours: number;
  pendingExpiryHours: number;
  statsMinGroupSize: number;
  userHourQuota: number | null;
  attachment: { maxSizeMb: number; acceptedTypes: string[] };
}

/**
 * ค่าตั้งต้น — ของจริงถูกทับด้วยค่าจากตาราง app_settings ตอนที่ store โหลดข้อมูล
 * (ดู applyPolicySettings ด้านล่าง) เพื่อไม่ให้มีนโยบาย 2 ชุดที่ขัดกันเอง
 */
export const POLICY: Policy = {
  timeZone: "Asia/Bangkok",
  /** เวลาที่จองได้ปกติ — นอกช่วงนี้จองได้ แต่ต้องแนบเอกสารและรออนุมัติ */
  openTime: "07:00",
  closeTime: "18:00",
  /** หน่วยเวลาย่อยของ slot (นาที) */
  slotMinutes: 30,
  /** ความยาวการจองต่อครั้ง — ขั้นต่ำ 30 นาที, ไม่มีเพดาน */
  minDurationMinutes: 30,
  maxDurationMinutes: null as number | null,
  /** จองล่วงหน้าอย่างน้อยกี่วัน — นับเป็นวันปฏิทิน ไม่ตัดเสาร์-อาทิตย์/วันหยุด */
  leadTimeDays: 3,
  /** จองล่วงหน้าได้ไกลสุด (ad-hoc) */
  bookingHorizonDays: 60,
  /** ยกเลิกล่วงหน้าอย่างน้อยกี่ชั่วโมง */
  cancelNoticeHours: 24,
  /** คำขอที่ยังไม่ถูกตัดสินหมดอายุใน */
  pendingExpiryHours: 48,
  /** ปกปิดกลุ่มข้อมูลสถิติที่เล็กกว่านี้ (§8.4) */
  statsMinGroupSize: 5,
  /** โควตาชั่วโมงต่อผู้ใช้ — ไม่จำกัด */
  userHourQuota: null as number | null,
  attachment: {
    maxSizeMb: 10,
    acceptedTypes: ["PDF", "JPG", "PNG"],
  },
};

/**
 * นำค่าจากตาราง `app_settings` มาทับค่าตั้งต้น
 *
 * เรียกครั้งเดียวตอน store โหลดข้อมูลเสร็จ ก่อนที่หน้าจอใด ๆ จะถูก render
 * (store แสดงหน้ารอจนกว่าจะโหลดเสร็จ) ทุกหน้าจึงอ่านค่าเดียวกับที่อยู่ในฐานข้อมูลเสมอ
 * — เป็นการทำตาม §3 ที่ว่านโยบายต้องมี "แหล่งความจริงเดียว"
 */
export function applyPolicySettings(settings: Record<string, unknown>) {
  const num = (key: string, current: number) => {
    const v = settings[key];
    return typeof v === "number" && Number.isFinite(v) ? v : current;
  };
  const numOrNull = (key: string, current: number | null) => {
    if (!(key in settings)) return current;
    const v = settings[key];
    if (v === null) return null;
    return typeof v === "number" && Number.isFinite(v) ? v : current;
  };
  const str = (key: string, current: string) => {
    const v = settings[key];
    return typeof v === "string" && v ? v : current;
  };

  POLICY.timeZone = str("time_zone", POLICY.timeZone);
  POLICY.openTime = str("open_time", POLICY.openTime);
  POLICY.closeTime = str("close_time", POLICY.closeTime);
  POLICY.slotMinutes = num("slot_minutes", POLICY.slotMinutes);
  POLICY.minDurationMinutes = num("min_duration_minutes", POLICY.minDurationMinutes);
  POLICY.maxDurationMinutes = numOrNull("max_duration_minutes", POLICY.maxDurationMinutes);
  POLICY.leadTimeDays = num("lead_time_days", POLICY.leadTimeDays);
  POLICY.bookingHorizonDays = num("booking_horizon_days", POLICY.bookingHorizonDays);
  POLICY.cancelNoticeHours = num("cancel_notice_hours", POLICY.cancelNoticeHours);
  POLICY.pendingExpiryHours = num("pending_expiry_hours", POLICY.pendingExpiryHours);
  POLICY.statsMinGroupSize = num("stats_min_group_size", POLICY.statsMinGroupSize);
  POLICY.userHourQuota = numOrNull("user_hour_quota", POLICY.userHourQuota);
  POLICY.attachment.maxSizeMb = num("attachment_max_mb", POLICY.attachment.maxSizeMb);
  if (Array.isArray(settings.attachment_types)) {
    POLICY.attachment.acceptedTypes = settings.attachment_types as string[];
  }
}

/** ข้อกำหนดและเงื่อนไข — generate จากค่าข้างบน ไม่พิมพ์ตัวเลขตายตัว (§8.3) */
export function bookingTerms(): string[] {
  return [
    `กรุณาจองห้องล่วงหน้าอย่างน้อย ${POLICY.leadTimeDays} วัน (นับเป็นวันปฏิทิน รวมเสาร์–อาทิตย์และวันหยุด)`,
    `หากต้องการยกเลิก กรุณาดำเนินการผ่านระบบล่วงหน้าอย่างน้อย ${POLICY.cancelNoticeHours} ชั่วโมงก่อนเวลาเริ่มใช้งาน`,
    `ช่วงเวลาที่จองได้ตามปกติคือ ${POLICY.openTime} – ${POLICY.closeTime} น. — หากต้องใช้นอกช่วงนี้ ต้องแนบเอกสารเพิ่มเติมและรอการอนุมัติเป็นกรณีไป`,
    `คำขอทุกรายการต้องรอการอนุมัติจากแอดมินก่อน จึงจะส่งเรื่องให้ผู้ดูแลห้องเตรียมห้องต่อไป`,
    `ผู้จองต้องรับผิดชอบดูแลห้องและอุปกรณ์ตลอดช่วงเวลาที่ใช้งาน`,
  ];
}

export const CATEGORY_META: Record<
  BookingCategory,
  { label: string; color: string; text: string; ring: string; pattern: string; mark: string }
> = {
  CLASS: {
    label: "การเรียนการสอน",
    color: "bg-violet-500",
    text: "text-violet-700",
    ring: "ring-violet-200",
    pattern: "pattern-solid",
    mark: "▰",
  },
  MEETING: {
    label: "ประชุม",
    color: "bg-sky-500",
    text: "text-sky-700",
    ring: "ring-sky-200",
    pattern: "pattern-diagonal",
    mark: "▨",
  },
  TRAINING: {
    label: "อบรม / สัมมนา",
    color: "bg-emerald-500",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    pattern: "pattern-dots",
    mark: "▩",
  },
  ACTIVITY: {
    label: "กิจกรรม",
    color: "bg-amber-500",
    text: "text-amber-700",
    ring: "ring-amber-200",
    pattern: "pattern-grid",
    mark: "▤",
  },
  EXAM: {
    label: "สอบ",
    color: "bg-rose-500",
    text: "text-rose-700",
    ring: "ring-rose-200",
    pattern: "pattern-cross",
    mark: "▦",
  },
  MAINTENANCE: {
    label: "ปิดปรับปรุง",
    color: "bg-slate-500",
    text: "text-slate-700",
    ring: "ring-slate-200",
    pattern: "pattern-hatch",
    mark: "▧",
  },
};

export const STATUS_META: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  DRAFT: { label: "ฉบับร่าง", className: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  PENDING: { label: "รออนุมัติ", className: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "อนุมัติแล้ว", className: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "ถูกปฏิเสธ", className: "bg-rose-50 text-rose-800 ring-rose-200", dot: "bg-rose-500" },
  IN_USE: { label: "กำลังใช้งาน", className: "bg-violet-50 text-violet-800 ring-violet-200", dot: "bg-violet-500" },
  COMPLETED: { label: "ใช้งานแล้ว", className: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  NO_SHOW: { label: "ไม่มาใช้ห้อง", className: "bg-orange-50 text-orange-800 ring-orange-200", dot: "bg-orange-500" },
  CANCELLED_BY_USER: { label: "ผู้จองยกเลิก", className: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  CANCELLED_BY_ADMIN: { label: "แอดมินยกเลิก", className: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-400" },
};

export const ROLE_LABEL: Record<string, string> = {
  VIEWER: "ผู้เยี่ยมชม (ไม่ล็อกอิน)",
  GUEST: "บุคคลภายนอก",
  USER: "ผู้ใช้ทั่วไป",
  ROOM_MANAGER: "ผู้ดูแลห้อง",
  ADMIN: "แอดมิน (ผู้อนุมัติ)",
  SUPER_ADMIN: "ผู้ดูแลระบบ",
};

/** สถานะที่ถือว่า "กินที่" ในตาราง — PENDING กินที่ด้วย (§7 ข้อ 1) */
export const OCCUPYING_STATUSES = ["PENDING", "APPROVED", "IN_USE"] as const;

/**
 * ความยาวสูงสุดของชื่อเรื่องที่แสดงต่อสาธารณะ (§11.1)
 * ใช้ทั้งตอนตรวจฟอร์มและตอนตรวจซ้ำที่เซิร์ฟเวอร์ — ชื่อยาวเกินทำให้ตารางเวลาอ่านไม่ได้
 */
export const PUBLIC_TITLE_MAX = 40;
