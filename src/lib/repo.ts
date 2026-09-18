/**
 * Repository layer — ทางเข้า-ออกข้อมูลชั้นเดียวของทั้งระบบ (plan001.md §12 ข้อ 1)
 *
 * component ห้ามแตะ seed หรือ Db ตรง ๆ ต้องเรียกผ่านฟังก์ชันในไฟล์นี้เท่านั้น
 * วันที่ย้ายไป PostgreSQL จะแก้เฉพาะไฟล์นี้ (เปลี่ยนเป็น query จริง) โดยไม่ต้องรื้อ UI
 */

import { spacesOfUnit } from "./conflicts";
import { OCCUPYING_STATUSES } from "./policy";
import type {
  Blackout, Booking, BookingCategory, BookableUnit, Db, Floor, Role, User,
} from "./types";
import { addDays, dateKeyOf, minutesOfDay, overlaps, toIso } from "./time";

/* ---------------- ประเภทที่ใช้ร่วมกับ UI ---------------- */

export interface ScheduleEntry {
  id: string;
  kind: "BOOKING" | "BLACKOUT";
  unitId: string;
  startAt: string;
  endAt: string;
  /** ข้อความที่แสดงต่อสาธารณะได้เสมอ (§11.1) */
  publicTitle: string;
  category: BookingCategory;
  status: Booking["status"] | "BLOCKED";
  bookingId?: string;
}

export interface RoomCardView {
  unit: BookableUnit;
  floor: Floor;
  equipment: { id: string; name: string; icon: string }[];
}

/* ---------------- การอ่านข้อมูลอ้างอิง ---------------- */

export const listBuildings = (db: Db) => db.buildings.filter((b) => b.isActive);

export const listFloors = (db: Db, buildingId: string) =>
  db.floors.filter((f) => f.buildingId === buildingId).sort((a, b) => a.floorNo - b.floorNo);

export const getFloor = (db: Db, floorId: string) => db.floors.find((f) => f.id === floorId);

export const listUnits = (db: Db, opts: { floorId?: string; bookableOnly?: boolean } = {}) =>
  db.bookableUnits.filter(
    (u) =>
      (!opts.floorId || u.floorId === opts.floorId)
      && (!opts.bookableOnly || u.isBookable),
  );

export const getUnit = (db: Db, unitId: string) => db.bookableUnits.find((u) => u.id === unitId);

export const getUnitByCode = (db: Db, code: string) =>
  db.bookableUnits.find((u) => u.code.toLowerCase() === code.toLowerCase());

export const getUser = (db: Db, userId: string) => db.users.find((u) => u.id === userId);

export const equipmentOf = (db: Db, unit: BookableUnit) =>
  unit.equipmentIds
    .map((id) => db.equipment.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

export const holidayOn = (db: Db, dateKey: string) =>
  db.holidays.find((h) => h.date === dateKey) ?? null;

export const currentTerm = (db: Db, dateKey: string) =>
  db.terms.find((t) => t.startDate <= dateKey && dateKey <= t.endDate) ?? null;

export function roomCard(db: Db, unit: BookableUnit): RoomCardView {
  return {
    unit,
    floor: db.floors.find((f) => f.id === unit.floorId)!,
    equipment: equipmentOf(db, unit),
  };
}

/* ---------------- ตารางเวลา ---------------- */

/**
 * รายการที่กินที่ในตารางของ unit หนึ่งในวันหนึ่ง
 * รวมทั้ง booking ของ unit อื่นที่กิน space ร่วมกัน (เช่น 4305 กับ 4305-6)
 */
export function scheduleForDay(db: Db, unitId: string, dateKey: string): ScheduleEntry[] {
  const spaceIds = new Set(spacesOfUnit(db, unitId));
  const dayStart = toIso(dateKey, "00:00");
  const dayEnd = toIso(addDays(dateKey, 1), "00:00");
  const seen = new Set<string>();
  const out: ScheduleEntry[] = [];

  for (const bs of db.bookingSpaces) {
    if (!spaceIds.has(bs.spaceId)) continue;
    if (seen.has(bs.bookingId)) continue;
    if (!overlaps(bs.startAt, bs.endAt, dayStart, dayEnd)) continue;
    const b = db.bookings.find((x) => x.id === bs.bookingId);
    if (!b) continue;
    if (!(OCCUPYING_STATUSES as readonly string[]).includes(b.status)) continue;
    seen.add(b.id);
    out.push({
      id: b.id,
      kind: "BOOKING",
      unitId: b.unitId,
      startAt: b.startAt,
      endAt: b.endAt,
      publicTitle: b.publicTitle || "ไม่ระบุ",
      category: b.category,
      status: b.status,
      bookingId: b.id,
    });
  }

  // การบล็อก 1 ครั้งถูกกางเป็นรายการต่อ space ห้องรวมจึงเจอรายการเดียวกันหลายรอบ
  // ต้องรวบให้เหลือครั้งเดียว ไม่งั้นแท่งจะซ้อนกันและ key ของ React ชนกัน
  for (const bo of db.blackouts) {
    if (!spaceIds.has(bo.spaceId)) continue;
    if (seen.has(bo.id)) continue;
    if (!overlaps(bo.startAt, bo.endAt, dayStart, dayEnd)) continue;
    seen.add(bo.id);
    out.push({
      id: bo.id,
      kind: "BLACKOUT",
      unitId,
      startAt: bo.startAt,
      endAt: bo.endAt,
      publicTitle: bo.reason,
      category: "MAINTENANCE",
      status: "BLOCKED",
    });
  }

  return out.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function scheduleForRange(
  db: Db,
  unitId: string,
  fromKey: string,
  days: number,
): { dateKey: string; entries: ScheduleEntry[] }[] {
  return Array.from({ length: days }, (_, i) => {
    const dateKey = addDays(fromKey, i);
    return { dateKey, entries: scheduleForDay(db, unitId, dateKey) };
  });
}

/* ---------------- การจองของผู้ใช้ / คิวอนุมัติ ---------------- */

/**
 * รายการจองส่วนตัวของผู้ใช้ (§8.5)
 *
 * ไม่รวมครั้งที่เกิดจากตารางประจำเทอม — ตารางเรียนถูกสร้างในนามของห้อง
 * โดยผู้ดูแลห้องหรือแอดมิน ไม่ใช่คำขอส่วนตัวของคนนั้น การเอามาปนใน
 * "การจองของฉัน" ทำให้รายการท่วมจนหาคำขอจริงไม่เจอ และชวนให้เผลอกดยกเลิกทีละครั้ง
 * ตารางประจำเทอมจัดการได้ที่แท็บ "ตารางประจำเทอม" ของหน้าผู้ดูแลห้อง/แอดมิน
 */
export const bookingsOfUser = (db: Db, userId: string) =>
  db.bookings
    .filter((b) => b.ownerId === userId && !b.seriesId)
    .sort((a, b) => b.startAt.localeCompare(a.startAt));

export const pendingQueue = (db: Db) =>
  db.bookings
    .filter((b) => b.status === "PENDING")
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

export const approvalOf = (db: Db, bookingId: string) =>
  db.approvals.filter((a) => a.bookingId === bookingId).at(-1) ?? null;

/* ---------------- สิทธิ์การเห็นข้อมูล (§11.1) ---------------- */

export function canSeeBookingDetails(db: Db, viewer: User | null, booking: Booking): boolean {
  if (!viewer) return false;
  if (viewer.roles.includes("ADMIN") || viewer.roles.includes("SUPER_ADMIN")) return true;
  if (booking.ownerId === viewer.id) return true;
  return false;
}

export function hasRole(viewer: User | null, ...roles: Role[]): boolean {
  if (!viewer) return false;
  return roles.some((r) => viewer.roles.includes(r));
}

/* ---------------- การเขียนข้อมูล ---------------- */

/**
 * การเขียนทั้งหมดย้ายไปอยู่ที่ src/lib/db/actions.ts (server actions) แล้ว
 *
 * เหตุผล: การเขียนต้องทำในทรานแซกชันเดียวกับฐานข้อมูล ตรวจสิทธิ์ที่ฝั่งเซิร์ฟเวอร์
 * และให้ exclusion constraint เป็นตัวกันจองชนขั้นสุดท้าย (§6.3, §11.2)
 * ไฟล์นี้จึงเหลือเฉพาะฟังก์ชัน "อ่าน" ที่ทำงานบนก้อน Db ที่โหลดมาแล้ว
 */

export const blackoutsOfUnit = (db: Db, unitId: string): Blackout[] => {
  const spaceIds = new Set(spacesOfUnit(db, unitId));
  const seen = new Set<string>();
  return db.blackouts
    .filter((b) => spaceIds.has(b.spaceId))
    .filter((b) => {
      const key = `${b.startAt}|${b.endAt}|${b.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
};

/* ---------------- สถิติ (§8.4) ---------------- */

export interface MonthStats {
  totalBookings: number;
  totalHours: number;
  uniqueUsers: number;
  approvalRate: number;
  perUnit: { unitId: string; code: string; name: string; hours: number; count: number; utilization: number }[];
  heatmap: number[][];
  perCategory: { category: BookingCategory; count: number }[];
  suppressed: boolean;
}

export function monthStats(db: Db, monthKey: string): MonthStats {
  const inMonth = db.bookings.filter(
    (b) => dateKeyOf(b.startAt).startsWith(monthKey)
      && ["APPROVED", "IN_USE", "COMPLETED"].includes(b.status),
  );

  const hoursOf = (b: Booking) =>
    (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 3_600_000;

  const heatmap = Array.from({ length: 7 }, () => Array(12).fill(0) as number[]);
  for (const b of inMonth) {
    const dk = dateKeyOf(b.startAt);
    const wd = new Date(`${dk}T12:00:00Z`).getUTCDay();
    const from = Math.floor(minutesOfDay(b.startAt) / 60);
    const to = Math.ceil(minutesOfDay(b.endAt) / 60);
    for (let h = Math.max(7, from); h < Math.min(19, to); h++) heatmap[wd][h - 7] += 1;
  }

  const units = db.bookableUnits.filter((u) => u.isBookable);
  const daysInMonthCount = new Date(
    Number(monthKey.slice(0, 4)),
    Number(monthKey.slice(5, 7)),
    0,
  ).getDate();

  const perUnit = units.map((u) => {
    const list = inMonth.filter((b) => b.unitId === u.id);
    const hours = list.reduce((s, b) => s + hoursOf(b), 0);
    return {
      unitId: u.id,
      code: u.code,
      name: u.name,
      hours: Math.round(hours * 10) / 10,
      count: list.length,
      utilization: Math.min(1, hours / (daysInMonthCount * 11)),
    };
  }).sort((a, b) => b.hours - a.hours);

  const categories: BookingCategory[] = ["CLASS", "MEETING", "TRAINING", "ACTIVITY", "EXAM", "MAINTENANCE"];
  const perCategory = categories
    .map((category) => ({ category, count: inMonth.filter((b) => b.category === category).length }))
    .filter((c) => c.count > 0);

  const decided = db.bookings.filter(
    (b) => dateKeyOf(b.startAt).startsWith(monthKey)
      && ["APPROVED", "REJECTED", "IN_USE", "COMPLETED"].includes(b.status),
  );

  return {
    totalBookings: inMonth.length,
    totalHours: Math.round(inMonth.reduce((s, b) => s + hoursOf(b), 0)),
    uniqueUsers: new Set(inMonth.map((b) => b.ownerId)).size,
    approvalRate: decided.length
      ? decided.filter((b) => b.status !== "REJECTED").length / decided.length
      : 1,
    perUnit,
    heatmap,
    perCategory,
    suppressed: inMonth.length > 0 && inMonth.length < 5,
  };
}
