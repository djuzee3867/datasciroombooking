/**
 * Actions ฝั่งการจอง — รุ่น UI ล้วน (in-memory)
 *
 * ลายเซ็นของฟังก์ชันทุกตัวเหมือนรุ่นที่ต่อฐานข้อมูลจริงเป๊ะ ๆ เพื่อให้หน้าจอ
 * ไม่ต้องแก้ · ต่างกันแค่ข้างในที่เปลี่ยนจาก SQL มาเป็นการแก้ก้อน Db ในหน่วยความจำ
 * (ดู src/lib/db/mockdb.ts) — การตรวจสิทธิ์และกฎยังทำเหมือนเดิมเพื่อให้ UX สมจริง
 */

import {
  assertRole, audit, getAttachmentMeta, getDb, isAdmin, newId, notify, notifyAdmins,
  resetDb, resolveActor, snapshotDb,
} from "./mockdb";
import { findConflicts, spacesOfUnit } from "../conflicts";
import { POLICY, PUBLIC_TITLE_MAX } from "../policy";
import type { Booking, BookingCategory, Db } from "../types";
import { dateKeyOf, diffDays, hhmmOf, todayKey } from "../time";

export interface LoadedDb {
  db: Db;
  settings: Record<string, unknown>;
}

/* -------------------------------------------------------------- อ่านข้อมูล */

export async function fetchDb(): Promise<LoadedDb> {
  // รุ่นนี้ไม่มีตาราง app_settings — ใช้ค่าตั้งต้นจาก POLICY ทั้งหมด
  return { db: snapshotDb(), settings: {} };
}

/* ------------------------------------------------------------ สร้างคำขอจอง */

export interface CreateBookingPayload {
  unitId: string;
  startAt: string;
  endAt: string;
  publicTitle: string;
  category: BookingCategory;
  purpose: string;
  attendeeCount: number;
  contactPhone: string;
  attachmentName: string | null;
  attachmentId: string | null;
  note: string;
  outsideHours: boolean;
}

export type CreateBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; message: string };

export async function createBookingAction(
  actorId: string,
  input: CreateBookingPayload,
): Promise<CreateBookingResult> {
  try {
    const db = getDb();
    const actor = resolveActor(actorId);
    assertRole(actor, "USER", "GUEST", "ADMIN", "SUPER_ADMIN");
    const actorIsAdmin = isAdmin(actor);

    const unit = db.bookableUnits.find((u) => u.id === input.unitId);
    if (!unit) return { ok: false, message: "ไม่พบห้องที่เลือก" };

    const title = input.publicTitle.trim();
    if (!title) return { ok: false, message: "กรุณากรอกชื่อเรื่อง" };
    if (title.length > PUBLIC_TITLE_MAX) {
      return { ok: false, message: `ชื่อเรื่องยาวเกินไป (ไม่เกิน ${PUBLIC_TITLE_MAX} ตัวอักษร)` };
    }
    if (!input.purpose.trim()) return { ok: false, message: "กรุณาระบุวัตถุประสงค์การใช้งาน" };
    const phone = input.contactPhone.replace(/[\s-]/g, "");
    if (!/^0\d{8,9}$/.test(phone)) {
      return { ok: false, message: "รูปแบบหมายเลขโทรศัพท์ไม่ถูกต้อง" };
    }

    if (!unit.isBookable) {
      return { ok: false, message: unit.unbookableReason ?? "ห้องนี้ไม่เปิดให้จอง" };
    }
    if (!unit.openToGuest && actor.roles.includes("GUEST") && actor.roles.length === 1) {
      return { ok: false, message: "ห้องนี้ไม่เปิดให้บุคคลภายนอกจอง" };
    }
    if (input.attendeeCount > unit.capacity) {
      return { ok: false, message: `จำนวนผู้เข้าร่วมเกินความจุของห้อง (รองรับได้ ${unit.capacity} คน)` };
    }

    if (!actorIsAdmin) {
      const lead = diffDays(todayKey(), dateKeyOf(input.startAt));
      if (lead < POLICY.leadTimeDays) {
        return { ok: false, message: `ต้องจองล่วงหน้าอย่างน้อย ${POLICY.leadTimeDays} วัน` };
      }
      if (lead > POLICY.bookingHorizonDays) {
        return { ok: false, message: `จองล่วงหน้าได้ไกลสุด ${POLICY.bookingHorizonDays} วัน` };
      }
    }

    // คำนวณ "นอกเวลาให้บริการ" เอง ไม่เชื่อค่าที่ client ส่งมา
    const hours = unit.bookingHoursOverride ?? { open: POLICY.openTime, close: POLICY.closeTime };
    const startHhmm = hhmmOf(input.startAt);
    const endHhmm = hhmmOf(input.endAt);
    const spansDays = dateKeyOf(input.startAt) !== dateKeyOf(input.endAt);
    const outsideHours = spansDays || startHhmm < hours.open || endHhmm > hours.close;

    if (outsideHours && !input.attachmentName) {
      return {
        ok: false,
        message: `การใช้ห้องนอกเวลาให้บริการ (${hours.open}–${hours.close} น.) ต้องแนบเอกสารเพิ่มเติม`,
      };
    }

    // กันจองชน — ตรวจที่ระดับ space เหมือนรุ่นจริง
    if (findConflicts(db, unit.id, input.startAt, input.endAt).length) {
      return { ok: false, message: "ช่วงเวลานี้เพิ่งถูกจองไปแล้ว กรุณาเลือกเวลาอื่น" };
    }

    const att = input.attachmentId ? getAttachmentMeta(input.attachmentId) : undefined;
    const bookingId = newId("bk");
    const booking: Booking = {
      id: bookingId,
      seriesId: null,
      unitId: input.unitId,
      ownerId: actor.id,
      startAt: input.startAt,
      endAt: input.endAt,
      publicTitle: title,
      category: input.category,
      purpose: input.purpose.trim(),
      attendeeCount: input.attendeeCount,
      contactPhone: input.contactPhone.trim(),
      attachmentName: input.attachmentName,
      attachmentId: input.attachmentId,
      attachmentMime: att?.mimeType ?? null,
      attachmentSize: att?.byteSize ?? null,
      note: input.note.trim(),
      status: "PENDING",
      createdAt: new Date().toISOString(),
      outsideHours,
    };
    db.bookings.push(booking);
    for (const spaceId of spacesOfUnit(db, unit.id)) {
      db.bookingSpaces.push({ bookingId, spaceId, startAt: input.startAt, endAt: input.endAt });
    }

    audit(actor.id, "BOOKING_CREATED", "booking", bookingId, `ส่งคำขอจอง ${unit.code}`,
      bookingDigest(db, bookingId));
    notifyAdmins("NEW_REQUEST", "มีคำขอจองใหม่รออนุมัติ", `${unit.name} · ${title}`);

    return { ok: true, bookingId };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

/* ------------------------------------------------------- อนุมัติ / ปฏิเสธ */

export async function approveBookingsAction(actorId: string, bookingIds: string[]) {
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");

  for (const id of bookingIds) {
    const b = db.bookings.find((x) => x.id === id && x.status === "PENDING");
    if (!b) continue;
    b.status = "APPROVED";
    db.approvals.push({
      id: newId("ap"), bookingId: id, decidedBy: actor.id,
      decision: "APPROVED", reason: "", decidedAt: new Date().toISOString(),
    });

    const unit = db.bookableUnits.find((u) => u.id === b.unitId);
    audit(actor.id, "BOOKING_APPROVED", "booking", id, `อนุมัติคำขอ ${unit?.code ?? ""}`,
      bookingDigest(db, id));
    notify(b.ownerId, "APPROVED", "คำขอจองได้รับการอนุมัติแล้ว", `${unit?.name ?? ""} · ${b.publicTitle}`);
  }
}

export async function rejectBookingsAction(actorId: string, bookingIds: string[], reason: string) {
  const text = reason.trim();
  if (!text) throw new Error("การปฏิเสธต้องระบุเหตุผล");
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");

  for (const id of bookingIds) {
    const b = db.bookings.find((x) => x.id === id && x.status === "PENDING");
    if (!b) continue;
    b.status = "REJECTED";
    // คืนเวลาให้คนอื่นจอง — เอาแถว space ออก
    db.bookingSpaces = db.bookingSpaces.filter((bs) => bs.bookingId !== id);
    db.approvals.push({
      id: newId("ap"), bookingId: id, decidedBy: actor.id,
      decision: "REJECTED", reason: text, decidedAt: new Date().toISOString(),
    });
    const unit = db.bookableUnits.find((u) => u.id === b.unitId);
    audit(actor.id, "BOOKING_REJECTED", "booking", id, `ปฏิเสธคำขอ ${unit?.code ?? ""}: ${text}`,
      { ...bookingDigest(db, id), reason: text });
    notify(b.ownerId, "REJECTED", "คำขอจองถูกปฏิเสธ", `${unit?.name ?? ""} · เหตุผล: ${text}`);
  }
}

/* --------------------------------------------------------------- ยกเลิก */

export async function cancelBookingAction(
  actorId: string, bookingId: string, byAdmin: boolean, reason: string,
) {
  const db = getDb();
  const actor = resolveActor(actorId);
  const actorIsAdmin = isAdmin(actor);
  if (byAdmin && !actorIsAdmin) throw new Error("คุณไม่มีสิทธิ์ยกเลิกการจองของผู้อื่น");

  const b = db.bookings.find((x) => x.id === bookingId);
  if (!b) throw new Error("ไม่พบรายการจอง");
  if (!actorIsAdmin && b.ownerId !== actor.id) throw new Error("ยกเลิกได้เฉพาะการจองของตัวเอง");
  if (byAdmin && !reason.trim()) throw new Error("การยกเลิกโดยแอดมินต้องระบุเหตุผล");

  const now = Date.now();
  const hasStarted = new Date(b.startAt).getTime() <= now;
  const hasEnded = new Date(b.endAt).getTime() <= now;

  if (b.status !== "PENDING" && b.status !== "APPROVED") {
    throw new Error("รายการนี้ยกเลิกไม่ได้แล้ว — สถานะปัจจุบันไม่ใช่รออนุมัติหรืออนุมัติแล้ว");
  }
  if (hasEnded) throw new Error("รายการนี้ผ่านช่วงเวลาใช้ห้องไปแล้ว จึงยกเลิกย้อนหลังไม่ได้");
  if (!actorIsAdmin && hasStarted) {
    throw new Error("เริ่มเวลาใช้ห้องแล้ว — กรุณาติดต่อแอดมินหากต้องการยกเลิก");
  }
  if (!actorIsAdmin && b.status === "APPROVED") {
    const hoursLeft = (new Date(b.startAt).getTime() - now) / 3_600_000;
    if (hoursLeft < POLICY.cancelNoticeHours) {
      throw new Error(`ต้องยกเลิกล่วงหน้าอย่างน้อย ${POLICY.cancelNoticeHours} ชั่วโมง — กรุณาติดต่อแอดมิน`);
    }
  }

  const prevStatus = b.status;
  b.status = byAdmin ? "CANCELLED_BY_ADMIN" : "CANCELLED_BY_USER";
  if (reason.trim()) {
    b.note = `${b.note ? b.note + " · " : ""}เหตุผลการยกเลิก: ${reason.trim()}`;
  }
  db.bookingSpaces = db.bookingSpaces.filter((bs) => bs.bookingId !== bookingId);

  const unit = db.bookableUnits.find((u) => u.id === b.unitId);
  audit(actor.id, "BOOKING_CANCELLED", "booking", bookingId, `ยกเลิกการจอง ${unit?.code ?? ""}`,
    { ...bookingDigest(db, bookingId), cancelledBy: byAdmin ? "แอดมิน" : "ผู้จอง", reason: reason.trim() || null },
    { status: prevStatus });
  if (byAdmin) {
    notify(b.ownerId, "CANCELLED", "การจองถูกยกเลิกโดยแอดมิน", `${unit?.name ?? ""} · เหตุผล: ${reason.trim()}`);
  }
}

/* ------------------------------------------------------- บล็อกเวลาห้อง */

export async function createBlackoutAction(
  actorId: string, unitId: string, startAt: string, endAt: string, reason: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!reason.trim()) return { ok: false, message: "กรุณาระบุเหตุผลของการบล็อกเวลา" };
  try {
    const db = getDb();
    const actor = resolveActor(actorId);
    assertRole(actor, "ADMIN", "SUPER_ADMIN");

    if (findConflicts(db, unitId, startAt, endAt).length) {
      return { ok: false, message: "ช่วงเวลานี้มีรายการจองอยู่แล้ว กรุณาประสานแอดมินเพื่อยกเลิกก่อน" };
    }

    const id = newId("bo");
    // บล็อก 1 ครั้งกางเป็นรายแถวต่อ space เหมือน seed
    for (const spaceId of spacesOfUnit(db, unitId)) {
      db.blackouts.push({ id, spaceId, startAt, endAt, reason: reason.trim(), createdBy: actor.id });
    }
    const unit = db.bookableUnits.find((u) => u.id === unitId);
    audit(actor.id, "BLACKOUT_CREATED", "blackout", id, `บล็อกเวลาห้อง ${unit?.code ?? ""}: ${reason.trim()}`,
      { room: unit?.code ?? "", startAt, endAt, reason: reason.trim() });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "บล็อกเวลาไม่สำเร็จ" };
  }
}

export async function removeBlackoutAction(actorId: string, blackoutId: string) {
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");
  db.blackouts = db.blackouts.filter((b) => b.id !== blackoutId);
  audit(actor.id, "BLACKOUT_REMOVED", "blackout", blackoutId, "ยกเลิกการบล็อกเวลา");
}

/* ----------------------------------------------------------- จัดการห้อง */

export async function updateUnitAction(
  actorId: string,
  unitId: string,
  patch: { description?: string; contactNote?: string; capacity?: number; isBookable?: boolean },
) {
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");
  const unit = db.bookableUnits.find((u) => u.id === unitId);
  if (!unit) throw new Error("ไม่พบห้องนี้");

  if (patch.description !== undefined) unit.description = patch.description;
  if (patch.contactNote !== undefined) unit.contactNote = patch.contactNote;
  if (patch.capacity !== undefined) unit.capacity = patch.capacity;
  if (patch.isBookable !== undefined) {
    unit.isBookable = patch.isBookable;
    if (!patch.isBookable && !unit.unbookableReason) {
      unit.unbookableReason = "ปิดใช้งานชั่วคราวโดยแอดมิน";
    }
  }
  audit(actor.id, "UNIT_UPDATED", "bookableUnit", unitId, `แก้ไขข้อมูลห้อง ${unit.code}`,
    { room: unit.code, ...patch });
}

/* ------------------------------------------------- รีเซ็ตข้อมูลตัวอย่าง */

export async function resetDemoDataAction(actorId: string) {
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");
  resetDb();
}

/* ------------------------------------------------------ ตัวช่วย: ย่อการจอง */

function bookingDigest(db: Db, bookingId: string): Record<string, unknown> {
  const b = db.bookings.find((x) => x.id === bookingId);
  if (!b) return { bookingId };
  const unit = db.bookableUnits.find((u) => u.id === b.unitId);
  const owner = db.users.find((u) => u.id === b.ownerId);
  return {
    room: unit?.code ?? "",
    roomName: unit?.name ?? "",
    title: b.publicTitle,
    date: dateKeyOf(b.startAt),
    time: `${hhmmOf(b.startAt)}-${hhmmOf(b.endAt)}`,
    owner: owner?.name ?? "",
    ownerEmail: owner?.email ?? "",
    department: owner?.department ?? "",
    category: b.category,
    attendees: b.attendeeCount,
    contactPhone: b.contactPhone,
    outsideHours: b.outsideHours,
    status: b.status,
    attachmentName: b.attachmentName,
  };
}
