/**
 * Actions ฝั่งจัดการระบบ — รุ่น UI ล้วน (in-memory)
 *
 *   1. ตารางประจำเทอม
 *   2. แก้ไขรายละเอียดห้อง
 *   3. กำหนดสิทธิ์ผู้ใช้
 *   4. เพิ่มอาคารและห้องใหม่
 *   5. ภาคการศึกษา
 *   6. Audit log + ส่งออกรายการจอง
 *
 * ลายเซ็นเหมือนรุ่นฐานข้อมูลจริงทุกตัว ต่างแค่ทำงานบนก้อน Db ในหน่วยความจำ
 */

import {
  assertRole, assertUnitAuthority, audit, getDb, newId, notify, resolveActor,
} from "./mockdb";
import { findConflicts, spacesOfUnit } from "../conflicts";
import type {
  BookingCategory, BookingSeries, Db, Role,
} from "../types";
import { addDays, dateKeyOf, hhmmOf, toIso, weekdayOf } from "../time";

/* =========================================================================
   1. ตารางประจำเทอม
   ========================================================================= */

const DOW_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export interface SeriesInput {
  unitId: string;
  termId: string | null;
  title: string;
  category: BookingCategory;
  purpose: string;
  contactPhone: string;
  attendeeCount: number;
  weekdays: number[];
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string;
  skipHolidays: boolean;
  exclusions: { startsOn: string; endsOn: string; reason: string }[];
}

export interface SeriesOccurrence {
  date: string;
  skippedReason: string | null;
  conflictWith: string | null;
}

function validate(input: SeriesInput) {
  if (!input.weekdays.length) throw new Error("กรุณาเลือกวันในสัปดาห์อย่างน้อย 1 วัน");
  if (!input.title.trim()) throw new Error("กรุณากรอกชื่อวิชาหรือชื่อเรื่อง");
  if (!input.startsOn || !input.endsOn) throw new Error("กรุณาระบุช่วงวันที่ของตาราง");
  if (input.endsOn < input.startsOn) throw new Error("วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่ม");
  if (input.endTime <= input.startTime) throw new Error("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม");
}

/** กางวันที่ของตาราง + เหตุผลที่เว้น (แทน expand_series_dates ของ Postgres) */
function expandDates(db: Db, input: SeriesInput): { date: string; skippedReason: string | null }[] {
  const weekdays = new Set(input.weekdays);
  const excl = input.exclusions.filter((e) => e.startsOn && e.endsOn);
  const out: { date: string; skippedReason: string | null }[] = [];

  let date = input.startsOn;
  // กันลูปหลุด: จำกัดไม่เกิน 400 วัน
  for (let guard = 0; guard < 400 && date <= input.endsOn; guard++, date = addDays(date, 1)) {
    if (!weekdays.has(weekdayOf(date))) continue;

    let skippedReason: string | null = null;
    const inExcl = excl.find((e) => date >= e.startsOn && date <= e.endsOn);
    if (inExcl) {
      skippedReason = inExcl.reason.trim() || "อยู่ในช่วงที่เว้นไว้";
    } else if (input.skipHolidays) {
      const holiday = db.holidays.find((h) => h.date === date);
      if (holiday) skippedReason = `วันหยุด: ${holiday.name}`;
    }
    out.push({ date, skippedReason });
  }
  return out;
}

export async function previewSeriesAction(
  actorId: string,
  input: SeriesInput,
): Promise<{ occurrences: SeriesOccurrence[] }> {
  validate(input);
  const db = getDb();
  const actor = resolveActor(actorId);
  assertUnitAuthority(actor, input.unitId);

  const occurrences: SeriesOccurrence[] = expandDates(db, input).map(({ date, skippedReason }) => {
    let conflictWith: string | null = null;
    if (!skippedReason) {
      const c = findConflicts(db, input.unitId, toIso(date, input.startTime), toIso(date, input.endTime));
      if (c.length) conflictWith = c[0].label;
    }
    return { date, skippedReason, conflictWith };
  });
  return { occurrences };
}

export interface CreateSeriesResult {
  seriesId: string;
  created: number;
  skipped: number;
  conflicts: { date: string; with: string }[];
}

export async function createSeriesAction(
  actorId: string,
  input: SeriesInput,
): Promise<CreateSeriesResult> {
  validate(input);
  const db = getDb();
  const actor = resolveActor(actorId);
  assertUnitAuthority(actor, input.unitId);

  const unit = db.bookableUnits.find((u) => u.id === input.unitId);
  if (!unit) throw new Error("ไม่พบห้องที่เลือก");
  if (!unit.isBookable) throw new Error("ห้องนี้ไม่เปิดให้จอง");
  if (input.attendeeCount > unit.capacity) {
    throw new Error(`จำนวนผู้เข้าร่วมเกินความจุของห้อง (รองรับได้ ${unit.capacity} คน)`);
  }

  const seriesId = newId("sr");
  const rrule =
    `FREQ=WEEKLY;BYDAY=${input.weekdays.map((d) => DOW_CODES[d]).join(",")}`
    + `;UNTIL=${input.endsOn.replace(/-/g, "")}`;

  const series: BookingSeries = {
    id: seriesId,
    unitId: input.unitId,
    termId: input.termId,
    rrule,
    skipHolidays: input.skipHolidays,
    ownerId: actor.id,
    status: "APPROVED",
    title: input.title.trim(),
    category: input.category,
    purpose: input.purpose.trim(),
    contactPhone: input.contactPhone.trim(),
    attendeeCount: input.attendeeCount,
    weekdays: input.weekdays,
    startTime: input.startTime,
    endTime: input.endTime,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    createdBy: actor.id,
    createdAt: new Date().toISOString(),
    exclusions: input.exclusions
      .filter((e) => e.startsOn && e.endsOn)
      .map((e) => ({ id: newId("ex"), startsOn: e.startsOn, endsOn: e.endsOn, reason: e.reason.trim() })),
    bookingCount: 0,
  };
  db.bookingSeries.push(series);

  let created = 0;
  let skipped = 0;
  const conflicts: { date: string; with: string }[] = [];

  for (const { date, skippedReason } of expandDates(db, input)) {
    if (skippedReason) { skipped++; continue; }
    const startAt = toIso(date, input.startTime);
    const endAt = toIso(date, input.endTime);
    const c = findConflicts(db, input.unitId, startAt, endAt);
    if (c.length) {
      conflicts.push({ date, with: c[0].label || "รายการที่มีอยู่แล้ว" });
      continue;
    }
    const bookingId = newId("bk");
    db.bookings.push({
      id: bookingId, seriesId, unitId: input.unitId, ownerId: actor.id,
      startAt, endAt, publicTitle: input.title.trim(), category: input.category,
      purpose: input.purpose.trim(), attendeeCount: input.attendeeCount,
      contactPhone: input.contactPhone.trim(), attachmentName: null, attachmentId: null,
      attachmentMime: null, attachmentSize: null, note: "", status: "APPROVED",
      createdAt: new Date().toISOString(), outsideHours: false,
    });
    for (const spaceId of spacesOfUnit(db, input.unitId)) {
      db.bookingSpaces.push({ bookingId, spaceId, startAt, endAt });
    }
    created++;
  }
  series.bookingCount = created;

  audit(actor.id, "SERIES_CREATED", "bookingSeries", seriesId,
    `สร้างตารางประจำเทอม ${input.title.trim()} ที่ ${unit.code} · จองได้ ${created} ครั้ง`
    + (conflicts.length ? ` · ชน ${conflicts.length} ครั้ง` : ""),
    {
      room: unit.code,
      title: input.title.trim(),
      category: input.category,
      weekdays: input.weekdays.map((d) => THAI_WEEKDAYS[d]),
      time: `${input.startTime}-${input.endTime}`,
      range: `${input.startsOn} ถึง ${input.endsOn}`,
      exclusions: input.exclusions
        .filter((e) => e.startsOn && e.endsOn)
        .map((e) => `${e.startsOn} ถึง ${e.endsOn}${e.reason.trim() ? ` (${e.reason.trim()})` : ""}`),
      skipHolidays: input.skipHolidays,
      created,
      skipped,
      conflicts: conflicts.map((c) => `${c.date} ชนกับ ${c.with}`),
    });

  return { seriesId, created, skipped, conflicts };
}

export async function deleteSeriesAction(actorId: string, seriesId: string) {
  const db = getDb();
  const actor = resolveActor(actorId);
  const series = db.bookingSeries.find((s) => s.id === seriesId);
  if (!series) throw new Error("ไม่พบตารางประจำเทอมนี้");
  assertUnitAuthority(actor, series.unitId);

  // ลบเฉพาะครั้งที่ยังไม่ถึง เพื่อไม่ให้ประวัติที่ผ่านมาหายไป
  const now = Date.now();
  const removedIds = db.bookings
    .filter((b) => b.seriesId === seriesId && new Date(b.startAt).getTime() > now)
    .map((b) => b.id);
  const removedSet = new Set(removedIds);
  db.bookings = db.bookings.filter((b) => !removedSet.has(b.id));
  db.bookingSpaces = db.bookingSpaces.filter((bs) => !removedSet.has(bs.bookingId));
  db.bookingSeries = db.bookingSeries.filter((s) => s.id !== seriesId);

  audit(actor.id, "SERIES_DELETED", "bookingSeries", seriesId,
    `ลบตารางประจำเทอม ${series.title} · คืนเวลา ${removedIds.length} ครั้งที่ยังไม่ถึง`,
    { title: series.title, removedFutureBookings: removedIds.length });
}

/* =========================================================================
   2. แก้ไขรายละเอียดห้อง
   ========================================================================= */

export interface UnitPatch {
  description?: string;
  contactNote?: string;
  equipmentIds?: string[];
  name?: string;
  roomType?: string;
  capacity?: number;
  isBookable?: boolean;
  openToGuest?: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  unbookableReason?: string | null;
}

export async function updateUnitDetailsAction(actorId: string, unitId: string, patch: UnitPatch) {
  const db = getDb();
  const actor = resolveActor(actorId);
  assertUnitAuthority(actor, unitId);

  const unit = db.bookableUnits.find((u) => u.id === unitId);
  if (!unit) throw new Error("ไม่พบห้องนี้");

  const before: Record<string, unknown> = {
    description: unit.description, contactNote: unit.contactNote, name: unit.name,
    roomType: unit.roomType, capacity: unit.capacity, isBookable: unit.isBookable,
    openToGuest: unit.openToGuest, openTime: unit.bookingHoursOverride?.open ?? null,
    closeTime: unit.bookingHoursOverride?.close ?? null, unbookableReason: unit.unbookableReason ?? null,
  };

  if (patch.description !== undefined) unit.description = patch.description;
  if (patch.contactNote !== undefined) unit.contactNote = patch.contactNote;
  if (patch.name !== undefined) unit.name = patch.name;
  if (patch.roomType !== undefined) unit.roomType = patch.roomType;
  if (patch.capacity !== undefined) unit.capacity = patch.capacity;
  if (patch.openToGuest !== undefined) unit.openToGuest = patch.openToGuest;
  if (patch.equipmentIds) unit.equipmentIds = [...patch.equipmentIds];

  // เวลาให้บริการเฉพาะห้อง — แก้ทีละช่องได้
  if (patch.openTime !== undefined || patch.closeTime !== undefined) {
    const cur = unit.bookingHoursOverride ?? { open: "07:00", close: "18:00" };
    const open = patch.openTime !== undefined ? patch.openTime : cur.open;
    const close = patch.closeTime !== undefined ? patch.closeTime : cur.close;
    unit.bookingHoursOverride = open && close ? { open, close } : null;
  }

  if (patch.isBookable !== undefined) {
    unit.isBookable = patch.isBookable;
    if (patch.isBookable) {
      unit.unbookableReason = undefined;
    } else {
      unit.unbookableReason = patch.unbookableReason ?? unit.unbookableReason ?? "ปิดใช้งานชั่วคราวโดยแอดมิน";
    }
  } else if (patch.unbookableReason !== undefined && !unit.isBookable) {
    unit.unbookableReason = patch.unbookableReason ?? undefined;
  }

  audit(actor.id, "UNIT_UPDATED", "bookableUnit", unitId,
    `แก้ไขข้อมูลห้อง ${unit.code} (${Object.keys(patch).join(", ")})`,
    { room: unit.code, ...patch }, before);
}

/* =========================================================================
   3. กำหนดสิทธิ์ผู้ใช้
   ========================================================================= */

export async function setUserRoleAction(actorId: string, userId: string, role: Role, grant: boolean) {
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");

  if (role === "VIEWER") throw new Error("VIEWER ไม่ใช่สิทธิ์ที่กำหนดให้ผู้ใช้ได้");
  if (role === "SUPER_ADMIN" && !actor.roles.includes("SUPER_ADMIN")) {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่กำหนดสิทธิ์ผู้ดูแลระบบได้");
  }
  if (!grant && userId === actor.id && (role === "ADMIN" || role === "SUPER_ADMIN")) {
    throw new Error("ถอดสิทธิ์ของตัวเองไม่ได้ — ให้ผู้ดูแลระบบคนอื่นเป็นผู้ดำเนินการ");
  }

  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error("ไม่พบผู้ใช้นี้");

  if (grant) {
    if (!user.roles.includes(role)) user.roles = [...user.roles, role];
  } else {
    if (role === "ADMIN") {
      const admins = db.users.filter((u) => u.roles.includes("ADMIN")).length;
      if (admins <= 1) throw new Error("ต้องเหลือแอดมินอย่างน้อย 1 คนในระบบ");
    }
    user.roles = user.roles.filter((r) => r !== role);
  }

  audit(actor.id, grant ? "ROLE_GRANTED" : "ROLE_REVOKED", "user", userId,
    `${grant ? "ให้สิทธิ์" : "ถอดสิทธิ์"} ${role} กับ ${user.name}`,
    { role, granted: grant, userName: user.name, userEmail: user.email });
  if (grant) {
    notify(userId, "ROLE_GRANTED", "คุณได้รับสิทธิ์เพิ่มในระบบจองห้อง", `ได้รับสิทธิ์ ${role}`);
  }
}

/* =========================================================================
   4. เพิ่มอาคารและห้องใหม่
   ========================================================================= */

export interface CreateBuildingInput {
  code: string;
  name: string;
  floors: { floorNo: number; name: string }[];
}

export async function createBuildingAction(actorId: string, input: CreateBuildingInput) {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("กรุณากรอกรหัสอาคาร");
  if (!input.name.trim()) throw new Error("กรุณากรอกชื่ออาคาร");
  if (!input.floors.length) throw new Error("กรุณาระบุชั้นอย่างน้อย 1 ชั้น");

  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");
  if (db.buildings.some((b) => b.code.toUpperCase() === code)) {
    throw new Error(`มีอาคารรหัส ${code} อยู่แล้ว`);
  }

  const buildingId = newId("bld");
  db.buildings.push({ id: buildingId, code, name: input.name.trim(), isActive: true });
  for (const f of input.floors) {
    db.floors.push({ id: newId("fl"), buildingId, floorNo: f.floorNo, name: f.name.trim() || `ชั้น ${f.floorNo}` });
  }
  audit(actor.id, "BUILDING_CREATED", "building", buildingId,
    `เพิ่มอาคาร ${code} · ${input.floors.length} ชั้น`,
    { code, name: input.name.trim(), floors: input.floors.map((f) => f.floorNo) });
  return { buildingId };
}

export interface CreateUnitInput {
  floorId: string;
  code: string;
  name: string;
  roomType: string;
  capacity: number;
  isBookable: boolean;
  openToGuest: boolean;
  openTime: string | null;
  closeTime: string | null;
  description: string;
  contactNote: string;
  unbookableReason: string;
  equipmentIds: string[];
  spaceMode: "new" | "existing";
  spaceIds: string[];
}

export async function createUnitAction(actorId: string, input: CreateUnitInput) {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("กรุณากรอกรหัสห้อง");
  if (!input.name.trim()) throw new Error("กรุณากรอกชื่อห้อง");
  if (!input.isBookable && !input.unbookableReason.trim()) {
    throw new Error("ห้องที่ไม่เปิดให้จองต้องระบุเหตุผล เพื่อให้ผู้ใช้เข้าใจ");
  }
  if (input.spaceMode === "existing" && !input.spaceIds.length) {
    throw new Error("ห้องรวมต้องเลือกพื้นที่ที่ห้องนี้กินอย่างน้อย 1 พื้นที่");
  }

  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");
  if (db.bookableUnits.some((u) => u.code.toUpperCase() === code)) {
    throw new Error(`มีห้องหรือพื้นที่รหัส ${code} อยู่แล้ว`);
  }

  const unitId = newId("unit");
  db.bookableUnits.push({
    id: unitId,
    floorId: input.floorId,
    code,
    name: input.name.trim(),
    capacity: input.capacity,
    isBookable: input.isBookable,
    openToGuest: input.openToGuest,
    bookingHoursOverride: input.openTime && input.closeTime
      ? { open: input.openTime, close: input.closeTime } : null,
    description: input.description.trim(),
    contactNote: input.contactNote.trim(),
    unbookableReason: input.isBookable ? undefined : input.unbookableReason.trim(),
    roomType: input.roomType.trim(),
    images: ["a"],
    equipmentIds: [...input.equipmentIds],
  });

  let spaceIds = input.spaceIds;
  if (input.spaceMode === "new") {
    const spaceId = newId("sp");
    db.spaces.push({ id: spaceId, floorId: input.floorId, code });
    spaceIds = [spaceId];
  }
  for (const spaceId of spaceIds) {
    if (!db.unitSpaces.some((us) => us.unitId === unitId && us.spaceId === spaceId)) {
      db.unitSpaces.push({ unitId, spaceId });
    }
  }

  audit(actor.id, "UNIT_CREATED", "bookableUnit", unitId, `เพิ่มห้อง ${code} (${input.name.trim()})`, {
    code, name: input.name.trim(), roomType: input.roomType.trim(), capacity: input.capacity,
    isBookable: input.isBookable, openToGuest: input.openToGuest,
    spaceMode: input.spaceMode === "new" ? "สร้างพื้นที่ใหม่" : "ห้องรวมที่กินพื้นที่เดิม",
    spaceCount: spaceIds.length,
  });
  return { unitId };
}

/* =========================================================================
   5. ภาคการศึกษา
   ========================================================================= */

export interface TermInput {
  name: string;
  startDate: string;
  endDate: string;
}

function validateTerm(input: TermInput) {
  if (!input.name.trim()) throw new Error("กรุณากรอกชื่อภาคการศึกษา");
  if (!input.startDate || !input.endDate) throw new Error("กรุณาระบุวันเริ่มและวันสิ้นสุด");
  if (input.endDate <= input.startDate) throw new Error("วันสิ้นสุดต้องอยู่หลังวันเริ่ม");
}

const rangesOverlap = (aS: string, aE: string, bS: string, bE: string) => aS <= bE && bS <= aE;

export async function createTermAction(actorId: string, input: TermInput): Promise<{ termId: string }> {
  validateTerm(input);
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");
  if (db.terms.some((t) => rangesOverlap(input.startDate, input.endDate, t.startDate, t.endDate))) {
    throw new Error("ช่วงวันที่นี้ทับกับภาคการศึกษาที่มีอยู่แล้ว — ภาคการศึกษาห้ามคาบเกี่ยวกัน");
  }
  const termId = newId("term");
  db.terms.push({ id: termId, name: input.name.trim(), startDate: input.startDate, endDate: input.endDate });
  audit(actor.id, "TERM_CREATED", "term", termId,
    `เพิ่มภาคการศึกษา ${input.name.trim()} (${input.startDate} ถึง ${input.endDate})`,
    { name: input.name.trim(), startDate: input.startDate, endDate: input.endDate });
  return { termId };
}

export async function updateTermAction(actorId: string, termId: string, input: TermInput) {
  validateTerm(input);
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");
  const term = db.terms.find((t) => t.id === termId);
  if (!term) throw new Error("ไม่พบภาคการศึกษานี้");
  if (db.terms.some((t) => t.id !== termId && rangesOverlap(input.startDate, input.endDate, t.startDate, t.endDate))) {
    throw new Error("ช่วงวันที่นี้ทับกับภาคการศึกษาที่มีอยู่แล้ว — ภาคการศึกษาห้ามคาบเกี่ยวกัน");
  }
  const before = { name: term.name, startDate: term.startDate, endDate: term.endDate };
  term.name = input.name.trim();
  term.startDate = input.startDate;
  term.endDate = input.endDate;
  audit(actor.id, "TERM_UPDATED", "term", termId, `แก้ไขภาคการศึกษา ${input.name.trim()}`,
    { name: input.name.trim(), startDate: input.startDate, endDate: input.endDate }, before);
}

export async function deleteTermAction(actorId: string, termId: string) {
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");
  const term = db.terms.find((t) => t.id === termId);
  if (!term) throw new Error("ไม่พบภาคการศึกษานี้");
  if (db.bookingSeries.some((s) => s.termId === termId)) {
    throw new Error("ลบไม่ได้ เพราะมีตารางประจำเทอมอ้างถึงภาคการศึกษานี้อยู่");
  }
  db.terms = db.terms.filter((t) => t.id !== termId);
  audit(actor.id, "TERM_DELETED", "term", termId, `ลบภาคการศึกษา ${term.name}`, null,
    { name: term.name, startDate: term.startDate, endDate: term.endDate });
}

/* =========================================================================
   6. Audit log
   ========================================================================= */

export interface AuditFilter {
  from?: string | null;
  to?: string | null;
  action?: string | null;
  actorId?: string | null;
  search?: string | null;
  limit?: number;
}

export interface AuditRow {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  detail: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
}

export async function fetchAuditLogsAction(actorId: string, filter: AuditFilter = {}): Promise<AuditRow[]> {
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");

  const limit = Math.min(Math.max(filter.limit ?? 2000, 1), 10000);
  const search = filter.search?.trim().toLowerCase() || null;

  return db.auditLogs
    .filter((l) => {
      const day = dateKeyOf(l.at);
      if (filter.from && day < filter.from) return false;
      if (filter.to && day > filter.to) return false;
      if (filter.action && l.action !== filter.action) return false;
      if (filter.actorId && l.actorId !== filter.actorId) return false;
      if (search) {
        const actorName = db.users.find((u) => u.id === l.actorId)?.name.toLowerCase() ?? "";
        if (!l.summary.toLowerCase().includes(search) && !actorName.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((l) => {
      const u = db.users.find((x) => x.id === l.actorId);
      return {
        id: l.id,
        at: l.at,
        actorId: l.actorId,
        actorName: u?.name ?? "",
        actorEmail: u?.email ?? "",
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        summary: l.summary,
        detail: l.detail,
        before: l.before,
      };
    });
}

/* =========================================================================
   7. ส่งออกรายการจอง
   ========================================================================= */

export type BookingScope = "UPCOMING" | "PAST" | "ALL";

export interface BookingExportFilter {
  from?: string | null;
  to?: string | null;
  scope?: BookingScope;
}

export interface BookingExportRow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  room: string;
  roomName: string;
  floor: number;
  title: string;
  category: string;
  status: string;
  owner: string;
  ownerEmail: string;
  department: string;
  attendees: number;
  contactPhone: string;
  outsideHours: boolean;
  attachmentName: string;
  fromSeries: boolean;
  approvedBy: string;
  rejectReason: string;
  createdAt: string;
}

export async function exportBookingsAction(
  actorId: string, filter: BookingExportFilter = {},
): Promise<BookingExportRow[]> {
  const db = getDb();
  const actor = resolveActor(actorId);
  assertRole(actor, "ADMIN", "SUPER_ADMIN");

  const scope: BookingScope = filter.scope ?? "ALL";
  const now = Date.now();

  return db.bookings
    .filter((b) => {
      const day = dateKeyOf(b.startAt);
      if (filter.from && day < filter.from) return false;
      if (filter.to && day > filter.to) return false;
      const ended = new Date(b.endAt).getTime() < now;
      if (scope === "UPCOMING") {
        return !ended && ["PENDING", "APPROVED", "IN_USE"].includes(b.status);
      }
      if (scope === "PAST") {
        return ended && ["APPROVED", "IN_USE", "COMPLETED", "NO_SHOW"].includes(b.status);
      }
      return true;
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((b) => {
      const unit = db.bookableUnits.find((u) => u.id === b.unitId);
      const floor = db.floors.find((f) => f.id === unit?.floorId);
      const owner = db.users.find((u) => u.id === b.ownerId);
      const approval = db.approvals.filter((a) => a.bookingId === b.id).at(-1) ?? null;
      const decidedBy = approval ? db.users.find((u) => u.id === approval.decidedBy) : undefined;
      const hours = Math.round(
        ((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 3_600_000) * 100,
      ) / 100;
      return {
        id: b.id,
        date: dateKeyOf(b.startAt),
        startTime: hhmmOf(b.startAt),
        endTime: hhmmOf(b.endAt),
        hours,
        room: unit?.code ?? "",
        roomName: unit?.name ?? "",
        floor: floor?.floorNo ?? 0,
        title: b.publicTitle,
        category: b.category,
        status: b.status,
        owner: owner?.name ?? "",
        ownerEmail: owner?.email ?? "",
        department: owner?.department ?? "",
        attendees: b.attendeeCount,
        contactPhone: b.contactPhone,
        outsideHours: b.outsideHours,
        attachmentName: b.attachmentName ?? "",
        fromSeries: b.seriesId !== null,
        approvedBy: approval?.decision === "APPROVED" ? decidedBy?.name ?? "" : "",
        rejectReason: approval?.decision === "REJECTED" ? approval.reason : "",
        createdAt: `${dateKeyOf(b.createdAt)} ${hhmmOf(b.createdAt)}`,
      };
    });
}
