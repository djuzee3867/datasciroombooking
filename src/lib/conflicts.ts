/**
 * การกันจองชน — ฟังก์ชันกลางที่เดียวของทั้งระบบ (plan001.md §6.3, §12 ข้อ 3)
 *
 * หลักการ: ผู้ใช้จอง "bookableUnit" แต่การตรวจการชนทำที่ระดับ "space" เสมอ
 * จอง SCB4305-6 จึงบล็อก SCB4305 และ SCB4306 อัตโนมัติ และในทางกลับกันด้วย
 *
 * ห้ามเขียนตรรกะตรวจการชนซ้ำใน component ใด ๆ — UI เรียกฟังก์ชันนี้เพื่อแสดงผลเท่านั้น
 *
 * ข้อจำกัดที่ยอมรับในเฟส prototype: ไม่มี transaction จริง ถ้ามี 2 คนกดพร้อมกันเป๊ะ ๆ
 * ยังมีโอกาสหลุดได้ — จะปิดช่องนี้ด้วย exclusion constraint ตอนขึ้น PostgreSQL
 */

import { OCCUPYING_STATUSES, POLICY, PUBLIC_TITLE_MAX } from "./policy";
import type { Booking, BookableUnit, Db } from "./types";
import {
  addDays, dateKeyOf, diffDays, hhmmToMinutes, minutesOfDay, minutesToHhmm, overlaps,
  todayKey, toIso,
} from "./time";

export interface Conflict {
  kind: "BOOKING" | "BLACKOUT";
  spaceCode: string;
  startAt: string;
  endAt: string;
  label: string;
  bookingId?: string;
}

/** ขยาย 1 bookableUnit ออกเป็นรายการ space ที่มันกินจริง */
export function spacesOfUnit(db: Db, unitId: string): string[] {
  return db.unitSpaces.filter((us) => us.unitId === unitId).map((us) => us.spaceId);
}

/** unit ทั้งหมดที่กิน space ใด space หนึ่งร่วมกับ unit ที่ให้มา (รวมตัวมันเอง) */
export function overlappingUnits(db: Db, unitId: string): string[] {
  const spaces = new Set(spacesOfUnit(db, unitId));
  return Array.from(
    new Set(db.unitSpaces.filter((us) => spaces.has(us.spaceId)).map((us) => us.unitId)),
  );
}

function spaceCode(db: Db, spaceId: string): string {
  return db.spaces.find((s) => s.id === spaceId)?.code ?? spaceId;
}

/**
 * หารายการที่ชนกับช่วงเวลาที่ขอ
 * @param ignoreBookingId ข้ามรายการนี้ (ใช้ตอนแก้ไขการจองเดิม)
 */
export function findConflicts(
  db: Db,
  unitId: string,
  startAt: string,
  endAt: string,
  ignoreBookingId?: string,
): Conflict[] {
  const spaceIds = new Set(spacesOfUnit(db, unitId));
  const out: Conflict[] = [];

  for (const bs of db.bookingSpaces) {
    if (!spaceIds.has(bs.spaceId)) continue;
    if (bs.bookingId === ignoreBookingId) continue;
    const booking = db.bookings.find((b) => b.id === bs.bookingId);
    if (!booking) continue;
    if (!(OCCUPYING_STATUSES as readonly string[]).includes(booking.status)) continue;
    if (!overlaps(startAt, endAt, bs.startAt, bs.endAt)) continue;
    out.push({
      kind: "BOOKING",
      spaceCode: spaceCode(db, bs.spaceId),
      startAt: bs.startAt,
      endAt: bs.endAt,
      label: booking.publicTitle || "ไม่ระบุ",
      bookingId: booking.id,
    });
  }

  // ห้องรวมกินหลาย space การบล็อกครั้งเดียวจึงถูกกางมาหลายแถว — รายงานครั้งเดียวพอ
  const seenBlackouts = new Set<string>();
  for (const bo of db.blackouts) {
    if (!spaceIds.has(bo.spaceId)) continue;
    if (seenBlackouts.has(bo.id)) continue;
    if (!overlaps(startAt, endAt, bo.startAt, bo.endAt)) continue;
    seenBlackouts.add(bo.id);
    out.push({
      kind: "BLACKOUT",
      spaceCode: spaceCode(db, bo.spaceId),
      startAt: bo.startAt,
      endAt: bo.endAt,
      label: bo.reason,
    });
  }

  return out.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** เวลาให้บริการของห้องนี้ — ค่ากลางจาก §3 หรือค่าเฉพาะห้อง */
export function bookingHoursOf(unit: BookableUnit | undefined) {
  return unit?.bookingHoursOverride ?? { open: POLICY.openTime, close: POLICY.closeTime };
}

/**
 * กรอบเวลาที่ "แถบตาราง" ต้องวาด — ขยายจากเวลาให้บริการให้ครอบคลุมรายการที่อยู่นอกเวลา
 *
 * ถ้าไม่ขยาย รายการนอกเวลา (เช่น อบรมภาคค่ำ 18:30–20:00 ในห้องที่ปิด 18:00)
 * จะถูกดันไปกองอยู่ริมกรอบจนมองไม่เห็น ทำให้ห้องที่ถูกจองอยู่ดูเหมือนว่าง
 */
export function displayHours(
  hours: { open: string; close: string },
  entries: { startAt: string; endAt: string }[],
): { open: string; close: string } {
  let open = hhmmToMinutes(hours.open);
  let close = hhmmToMinutes(hours.close);
  for (const e of entries) {
    open = Math.min(open, minutesOfDay(e.startAt));
    // รายการที่จบข้ามวันจะได้ค่านาทีน้อยกว่าที่เริ่ม — ปัดไปสุดปลายวันแทน
    const end = minutesOfDay(e.endAt);
    close = Math.max(close, end <= minutesOfDay(e.startAt) ? 24 * 60 : end);
  }
  // ปัดลง/ขึ้นเป็นชั่วโมงเต็ม เพื่อให้เส้นบอกชั่วโมงยังตรงกับหัวตาราง
  return {
    open: minutesToHhmm(Math.max(0, Math.floor(open / 60) * 60)),
    close: minutesToHhmm(Math.min(24 * 60, Math.ceil(close / 60) * 60)),
  };
}

/** วันแรกที่จองได้จริงตามกฎ lead time (§8.3) */
export function firstBookableDate(today = todayKey()): string {
  return addDays(today, POLICY.leadTimeDays);
}

export function lastBookableDate(today = todayKey()): string {
  return addDays(today, POLICY.bookingHorizonDays);
}

export interface DateAvailability {
  selectable: boolean;
  reason?: string;
}

export function dateSelectable(dateKey: string, today = todayKey()): DateAvailability {
  const lead = diffDays(today, dateKey);
  if (lead < 0) return { selectable: false, reason: "เป็นวันที่ผ่านมาแล้ว" };
  if (lead < POLICY.leadTimeDays) {
    return {
      selectable: false,
      reason: `ต้องจองล่วงหน้าอย่างน้อย ${POLICY.leadTimeDays} วัน — จองวันนี้ได้เร็วที่สุดคือ ${POLICY.leadTimeDays} วันข้างหน้า`,
    };
  }
  if (lead > POLICY.bookingHorizonDays) {
    return { selectable: false, reason: `จองล่วงหน้าได้ไกลสุด ${POLICY.bookingHorizonDays} วัน` };
  }
  return { selectable: true };
}

export interface BookingDraft {
  unitId: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  publicTitle: string;
  attendeeCount: number | "";
  purpose: string;
  contactPhone: string;
  attachmentName: string | null;
  note: string;
  category: Booking["category"];
  acceptedTerms: boolean;
}

export interface ValidationResult {
  errors: Record<string, string>;
  warnings: string[];
  conflicts: Conflict[];
  outsideHours: boolean;
  startAt: string;
  endAt: string;
}

/**
 * ตรวจคำขอจองทั้งใบ — ใช้ร่วมกันทั้งตอนพรีวิวบนฟอร์มและตอนกดส่งจริง
 * เพื่อไม่ให้กฎกระจายอยู่หลายที่
 */
export function validateDraft(
  db: Db,
  draft: BookingDraft,
  opts: { today?: string; isAdmin?: boolean; ignoreBookingId?: string } = {},
): ValidationResult {
  const today = opts.today ?? todayKey();
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const unit = db.bookableUnits.find((u) => u.id === draft.unitId);
  const hours = bookingHoursOf(unit);

  const startAt = draft.dateKey && draft.startTime ? toIso(draft.dateKey, draft.startTime) : "";
  const endAt = draft.dateKey && draft.endTime ? toIso(draft.dateKey, draft.endTime) : "";

  if (!unit) errors.unitId = "กรุณาเลือกห้อง";
  else if (!unit.isBookable) errors.unitId = unit.unbookableReason ?? "ห้องนี้ไม่เปิดให้จอง";

  if (!draft.dateKey) {
    errors.dateKey = "กรุณาเลือกวันที่ต้องการใช้งาน";
  } else if (!opts.isAdmin) {
    const sel = dateSelectable(draft.dateKey, today);
    if (!sel.selectable) errors.dateKey = sel.reason!;
  }

  if (!draft.startTime) errors.startTime = "กรุณาเลือกเวลาเริ่ม";
  if (!draft.endTime) errors.endTime = "กรุณาเลือกเวลาสิ้นสุด";

  let outsideHours = false;
  if (draft.startTime && draft.endTime) {
    const s = hhmmToMinutes(draft.startTime);
    const e = hhmmToMinutes(draft.endTime);
    if (e <= s) {
      errors.endTime = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
    } else if (e - s < POLICY.minDurationMinutes) {
      errors.endTime = `จองขั้นต่ำ ${POLICY.minDurationMinutes} นาที`;
    }
    if (s % POLICY.slotMinutes !== 0 || e % POLICY.slotMinutes !== 0) {
      errors.startTime = `เวลาต้องลงตัวทุก ${POLICY.slotMinutes} นาที`;
    }
    if (s < hhmmToMinutes(hours.open) || e > hhmmToMinutes(hours.close)) {
      outsideHours = true;
      warnings.push(
        `ช่วงเวลาที่เลือกอยู่นอกเวลาให้บริการปกติ (${hours.open}–${hours.close} น.) — ต้องแนบเอกสารเพิ่มเติมและรอการอนุมัติเป็นกรณีไป`,
      );
    }
  }

  if (!draft.publicTitle.trim()) {
    errors.publicTitle = "กรุณากรอกชื่อเรื่อง (ข้อความนี้จะแสดงต่อสาธารณะ)";
  } else if (draft.publicTitle.trim().length > PUBLIC_TITLE_MAX) {
    errors.publicTitle = `ชื่อเรื่องยาวเกินไป (ไม่เกิน ${PUBLIC_TITLE_MAX} ตัวอักษร)`;
  }

  if (draft.attendeeCount === "" || Number(draft.attendeeCount) <= 0) {
    errors.attendeeCount = "กรุณากรอกจำนวนผู้เข้าร่วม";
  } else if (unit && Number(draft.attendeeCount) > unit.capacity) {
    errors.attendeeCount = `เกินความจุของห้อง (รองรับได้ ${unit.capacity} คน)`;
  }

  if (!draft.purpose.trim()) errors.purpose = "กรุณาระบุวัตถุประสงค์การใช้งาน";

  const phone = draft.contactPhone.replace(/[\s-]/g, "");
  if (!phone) errors.contactPhone = "กรุณากรอกหมายเลขโทรศัพท์ติดต่อ";
  else if (!/^0\d{8,9}$/.test(phone)) errors.contactPhone = "รูปแบบหมายเลขโทรศัพท์ไม่ถูกต้อง";

  if (outsideHours && !draft.attachmentName) {
    errors.attachmentName = "การใช้ห้องนอกเวลาให้บริการต้องแนบเอกสารเพิ่มเติม";
  }

  if (!draft.acceptedTerms) errors.acceptedTerms = "กรุณายอมรับข้อกำหนดและเงื่อนไขก่อนส่งคำขอ";

  let conflicts: Conflict[] = [];
  if (unit && startAt && endAt && !errors.endTime && !errors.startTime) {
    conflicts = findConflicts(db, unit.id, startAt, endAt, opts.ignoreBookingId);
    if (conflicts.length) {
      errors.slot = "ช่วงเวลาที่เลือกทับกับรายการที่มีอยู่แล้ว กรุณาเลือกเวลาอื่น";
    }
  }

  return { errors, warnings, conflicts, outsideHours, startAt, endAt };
}

/** สถานะห้อง ณ เวลาหนึ่ง — ใช้กับป้าย "ว่างตอนนี้" (§8.1) */
export type UnitLiveStatus = "FREE" | "BUSY" | "CLOSED" | "UNBOOKABLE";

export function unitStatusAt(
  db: Db,
  unitId: string,
  atIso: string,
): { status: UnitLiveStatus; until?: string; title?: string } {
  const unit = db.bookableUnits.find((u) => u.id === unitId);
  if (!unit || !unit.isBookable) return { status: "UNBOOKABLE" };

  const hours = bookingHoursOf(unit);
  const mins = minutesOfDay(atIso);
  if (mins < hhmmToMinutes(hours.open) || mins >= hhmmToMinutes(hours.close)) {
    return { status: "CLOSED" };
  }

  const spaceIds = new Set(spacesOfUnit(db, unitId));
  const t = new Date(atIso).getTime();

  for (const bs of db.bookingSpaces) {
    if (!spaceIds.has(bs.spaceId)) continue;
    const booking = db.bookings.find((b) => b.id === bs.bookingId);
    if (!booking) continue;
    if (booking.status !== "APPROVED" && booking.status !== "IN_USE") continue;
    if (t >= new Date(bs.startAt).getTime() && t < new Date(bs.endAt).getTime()) {
      return { status: "BUSY", until: bs.endAt, title: booking.publicTitle || "ไม่ระบุ" };
    }
  }
  for (const bo of db.blackouts) {
    if (!spaceIds.has(bo.spaceId)) continue;
    if (t >= new Date(bo.startAt).getTime() && t < new Date(bo.endAt).getTime()) {
      return { status: "BUSY", until: bo.endAt, title: bo.reason };
    }
  }
  return { status: "FREE" };
}

/** สัดส่วนเวลาที่ถูกจองของวันนั้น 0–1 — ใช้กับ heatmap ปฏิทิน */
export function dayLoad(db: Db, unitId: string, dateKey: string): number {
  const unit = db.bookableUnits.find((u) => u.id === unitId);
  if (!unit) return 0;
  const hours = bookingHoursOf(unit);
  const total = hhmmToMinutes(hours.close) - hhmmToMinutes(hours.open);
  if (total <= 0) return 0;

  const spaceIds = new Set(spacesOfUnit(db, unitId));
  const busy: [number, number][] = [];
  const clamp = (v: number) => Math.min(Math.max(v, hhmmToMinutes(hours.open)), hhmmToMinutes(hours.close));

  for (const bs of db.bookingSpaces) {
    if (!spaceIds.has(bs.spaceId)) continue;
    if (dateKeyOf(bs.startAt) !== dateKey) continue;
    const b = db.bookings.find((x) => x.id === bs.bookingId);
    if (!b || !(OCCUPYING_STATUSES as readonly string[]).includes(b.status)) continue;
    busy.push([clamp(minutesOfDay(bs.startAt)), clamp(minutesOfDay(bs.endAt))]);
  }
  for (const bo of db.blackouts) {
    if (!spaceIds.has(bo.spaceId)) continue;
    if (dateKeyOf(bo.startAt) !== dateKey) continue;
    busy.push([clamp(minutesOfDay(bo.startAt)), clamp(minutesOfDay(bo.endAt))]);
  }

  busy.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = -1;
  for (const [s, e] of busy) {
    const from = Math.max(s, cursor);
    if (e > from) {
      covered += e - from;
      cursor = e;
    }
  }
  return Math.min(1, covered / total);
}
