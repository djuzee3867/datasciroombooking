/**
 * รูปทรงข้อมูลกลางของระบบ — อ้างอิงแผนงาน §6.2
 *
 * กติกา (plan001.md §12):
 *  - ใช้ชื่อ/รูปทรงเดียวกับที่จะเป็นตารางใน PostgreSQL เพื่อให้ย้ายลง DB เป็น map 1:1
 *  - เวลาทุกจุดเก็บเป็น ISO string ที่มี offset เสมอ (เช่น 2569-xx-xxT09:00:00+07:00)
 *    ห้ามเก็บเป็น "09:00" ลอย ๆ
 */

export type Role =
  | "VIEWER"
  | "GUEST"
  | "USER"
  | "ROOM_MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type BookingStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "IN_USE"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED_BY_USER"
  | "CANCELLED_BY_ADMIN";

/** ประเภทการจอง — ใช้กำหนดสี + ลวดลายในตารางรวมของแอดมิน (§10) */
export type BookingCategory =
  | "CLASS"
  | "MEETING"
  | "TRAINING"
  | "ACTIVITY"
  | "EXAM"
  | "MAINTENANCE";

export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  roles: Role[];
  phone?: string;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface Floor {
  id: string;
  buildingId: string;
  floorNo: number;
  name: string;
}

/** พื้นที่จริงที่แบ่งไม่ได้อีก — ใช้เป็นหน่วยตรวจการชนเสมอ (§6.1) */
export interface Space {
  id: string;
  floorId: string;
  code: string;
}

/** สิ่งที่ผู้ใช้เห็นและกดจอง — 1 unit กินได้หลาย space */
export interface BookableUnit {
  id: string;
  floorId: string;
  code: string;
  name: string;
  capacity: number;
  isBookable: boolean;
  openToGuest: boolean;
  /** ทับค่าเวลาให้บริการของระบบเฉพาะห้องนี้ (null = ใช้ค่ากลาง §3) */
  bookingHoursOverride: { open: string; close: string } | null;
  description: string;
  contactNote: string;
  unbookableReason?: string;
  roomType: string;
  images: string[];
  equipmentIds: string[];
}

export interface UnitSpace {
  unitId: string;
  spaceId: string;
}

export interface Equipment {
  id: string;
  name: string;
  icon: string;
}

export interface RoomManagerAssignment {
  userId: string;
  unitId: string;
}

export interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

/** §3.1 — ไม่บล็อกการจอง ใช้แสดงป้ายและเป็นตัวเลือกตอนจองทั้งเทอมเท่านั้น */
export interface Holiday {
  date: string;
  name: string;
}

/** ช่วงวันที่ที่ตารางประจำเทอมชุดนี้ไม่ต้องจอง เช่น สัปดาห์สอบกลางภาค */
export interface SeriesExclusion {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
}

/** ตารางประจำเทอม — กติกาการซ้ำ ที่ถูกกางเป็น bookings รายครั้ง (§13 เฟส 5) */
export interface BookingSeries {
  id: string;
  unitId: string;
  termId: string | null;
  rrule: string;
  skipHolidays: boolean;
  ownerId: string;
  status: BookingStatus;
  title: string;
  category: BookingCategory;
  purpose: string;
  contactPhone: string;
  attendeeCount: number;
  /** 0 = อาทิตย์ … 6 = เสาร์ */
  weekdays: number[];
  startTime: string;
  endTime: string;
  startsOn: string | null;
  endsOn: string | null;
  createdBy: string | null;
  createdAt: string;
  exclusions: SeriesExclusion[];
  /** จำนวนครั้งที่กางออกเป็นการจองจริงแล้ว */
  bookingCount: number;
}

export interface Booking {
  id: string;
  seriesId: string | null;
  unitId: string;
  ownerId: string;
  startAt: string;
  endAt: string;
  /** ชื่อเรื่องที่แสดงต่อสาธารณะ (§11.1) — ห้าม fallback เป็นชื่อผู้จอง/วัตถุประสงค์ */
  publicTitle: string;
  category: BookingCategory;
  purpose: string;
  attendeeCount: number;
  contactPhone: string;
  attachmentName: string | null;
  /** id ของไฟล์จริงในตาราง booking_attachments · null = ไม่มีไฟล์ให้เปิดดู */
  attachmentId: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  note: string;
  status: BookingStatus;
  createdAt: string;
  outsideHours: boolean;
}

/** ชุดข้อมูลที่ใช้ตรวจการชนจริง (§6.3) — 1 booking กระจายเป็นหลายแถวตาม space */
export interface BookingSpace {
  bookingId: string;
  spaceId: string;
  startAt: string;
  endAt: string;
}

export interface Blackout {
  id: string;
  spaceId: string;
  startAt: string;
  endAt: string;
  reason: string;
  createdBy: string;
}

export interface Approval {
  id: string;
  bookingId: string;
  decidedBy: string;
  decision: "APPROVED" | "REJECTED";
  reason: string;
  decidedAt: string;
}

/** เรื่องที่แอดมินอนุมัติแล้วส่งต่อให้ผู้ดูแลห้อง (§7 ข้อ 3) */
export interface Handoff {
  id: string;
  bookingId: string;
  roomManagerId: string | null;
  notifiedAt: string;
  acknowledgedAt: string | null;
  note: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  /** รายละเอียดเชิงโครงสร้าง (คอลัมน์ after) — ใช้แสดงในหน้า Audit log และส่งออก CSV */
  detail: Record<string, unknown> | null;
  /** ค่าก่อนแก้ไข ถ้ารายการนั้นเป็นการแก้ข้อมูล (คอลัมน์ before) */
  before: Record<string, unknown> | null;
  at: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/** ภาพรวมฐานข้อมูลทั้งก้อน — prototype เก็บใน memory, ของจริงคือ schema ของ Postgres */
export interface Db {
  users: User[];
  buildings: Building[];
  floors: Floor[];
  spaces: Space[];
  bookableUnits: BookableUnit[];
  unitSpaces: UnitSpace[];
  equipment: Equipment[];
  roomManagers: RoomManagerAssignment[];
  terms: Term[];
  holidays: Holiday[];
  bookingSeries: BookingSeries[];
  bookings: Booking[];
  bookingSpaces: BookingSpace[];
  blackouts: Blackout[];
  approvals: Approval[];
  handoffs: Handoff[];
  auditLogs: AuditLog[];
  notifications: Notification[];
}
