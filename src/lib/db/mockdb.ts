/**
 * ชั้นข้อมูลจำลองในหน่วยความจำ (mock data layer)
 *
 * รุ่นนี้เป็น "UI ล้วน" — ไม่มีฐานข้อมูล PostgreSQL และไม่มีระบบล็อกอินจริง
 * ทุกอย่างทำงานบนก้อน Db ก้อนเดียวที่สร้างจาก seed แล้วเก็บไว้ในหน่วยความจำของเบราว์เซอร์
 *
 *   หน้าจอ ──> useStore() ──> action ใน src/lib/db/*-actions.ts ──> mutate ก้อน Db ก้อนนี้
 *
 * การ "อ่าน" จะได้ก้อน Db ที่ถูก clone ใหม่ทุกครั้ง (getSnapshot) เพื่อให้ React เห็นว่า
 * ข้อมูลเปลี่ยนและ re-render · การ "เขียน" ทุก action แก้ก้อนจริง (live) แล้ว store โหลดซ้ำ
 *
 * ⚠️ ข้อมูลอยู่ในหน่วยความจำเท่านั้น — รีเฟรชหน้าเว็บแล้วข้อมูลจะกลับไปเป็น seed ชุดเดิม
 */

import { createSeed } from "../data/seed";
import type { AuditLog, Db, Notification, Role } from "../types";
import { todayKey } from "../time";

/* ----------------------------------------------------------------- ก้อนข้อมูล */

let liveDb: Db | null = null;

/** ก้อน Db จริงที่ทุก action เขียนลงไป */
export function getDb(): Db {
  if (!liveDb) liveDb = createSeed(todayKey());
  return liveDb;
}

/** สร้างข้อมูล seed ใหม่ทั้งชุด (ใช้กับปุ่มรีเซ็ตข้อมูลตัวอย่าง) */
export function resetDb(): void {
  liveDb = createSeed(todayKey());
}

/**
 * clone ก้อน Db เพื่อส่งให้ store — ต้องเป็น reference ใหม่ทุกครั้ง
 * ไม่งั้น useMemo ที่ผูกกับ [db] จะไม่คำนวณใหม่หลังมีการแก้ข้อมูล
 */
export function snapshotDb(): Db {
  const db = getDb();
  if (typeof structuredClone === "function") return structuredClone(db);
  return JSON.parse(JSON.stringify(db)) as Db;
}

/* ------------------------------------------------------------ ตัวช่วยสร้าง id */

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/* ------------------------------------------------------- ตัวตนผู้ใช้ (mock) */

/**
 * "เซสชัน" จำลอง — เก็บ id ผู้ใช้ที่ล็อกอินอยู่ไว้ใน localStorage
 *
 * รุ่นนี้ยังไม่แบ่งบทบาท จึง "ล็อกอินอัตโนมัติเป็นผู้ดูแลระบบ (SUPER_ADMIN)"
 * ให้เข้าได้ทุกหน้าโดยไม่ต้องล็อกอิน — เดี๋ยวค่อยแบ่ง role ทีหลัง
 */
const SESSION_KEY = "dsrb_mock_session";
/** ผู้ใช้เริ่มต้นเมื่อยังไม่ได้เลือกบัญชี — ผู้ดูแลระบบสิทธิ์สูงสุด */
const DEFAULT_USER_ID = "u-super";

let sessionUserId: string | null | undefined;

function readStoredSession(): string | null {
  if (typeof document === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function getSessionUserId(): string | null {
  if (sessionUserId === undefined) sessionUserId = readStoredSession() ?? DEFAULT_USER_ID;
  // ตรวจว่าผู้ใช้ยังอยู่ในระบบจริง (เผื่อโดนถอด/ลบ) — ถ้าไม่มีให้กลับไปใช้ค่าเริ่มต้น
  if (sessionUserId && !getDb().users.some((u) => u.id === sessionUserId)) {
    sessionUserId = DEFAULT_USER_ID;
  }
  return sessionUserId ?? DEFAULT_USER_ID;
}

export function setSessionUser(userId: string | null): void {
  // null = กลับไปใช้ผู้ใช้เริ่มต้น (ยังเข้าได้ทุกหน้าเสมอในรุ่นนี้)
  sessionUserId = userId ?? DEFAULT_USER_ID;
  if (typeof document === "undefined") return;
  try {
    if (userId) window.localStorage.setItem(SESSION_KEY, userId);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* โหมดส่วนตัวของเบราว์เซอร์อาจปิด storage — ปล่อยผ่านได้ */
  }
}

/* ------------------------------------------------------------- ตัวช่วย action */

export interface Actor {
  id: string;
  name: string;
  email: string;
  roles: Role[];
}

/** อ่านผู้ใช้ที่ทำรายการจากเซสชัน แล้วยืนยันว่ามีตัวตนจริง */
export function resolveActor(actorId?: string | null): Actor {
  const db = getDb();
  const id = actorId ?? getSessionUserId();
  const user = id ? db.users.find((u) => u.id === id) : null;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");
  return { id: user.id, name: user.name, email: user.email, roles: user.roles };
}

export function isAdmin(actor: Actor): boolean {
  return actor.roles.includes("ADMIN") || actor.roles.includes("SUPER_ADMIN");
}

export function assertRole(actor: Actor, ...allowed: Role[]): void {
  if (!allowed.some((r) => actor.roles.includes(r))) {
    throw new Error("คุณไม่มีสิทธิ์ทำรายการนี้");
  }
}

/** จัดการห้องได้เฉพาะแอดมิน (§10) */
export function assertUnitAuthority(actor: Actor, _unitId: string): void {
  if (isAdmin(actor)) return;
  throw new Error("คุณไม่มีสิทธิ์ทำรายการนี้");
}

/* --------------------------------------------------------- audit + แจ้งเตือน */

export function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  summary: string,
  detail: Record<string, unknown> | null = null,
  before: Record<string, unknown> | null = null,
): void {
  const log: AuditLog = {
    id: newId("al"),
    actorId,
    action,
    entity,
    entityId,
    summary,
    detail,
    before,
    at: new Date().toISOString(),
  };
  // ใหม่สุดอยู่หน้า เหมือน ORDER BY at DESC
  getDb().auditLogs.unshift(log);
}

export function notify(userId: string, type: string, title: string, body: string): void {
  const n: Notification = {
    id: newId("nt"),
    userId,
    type,
    title,
    body,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  getDb().notifications.unshift(n);
}

export function notifyAdmins(type: string, title: string, body: string): void {
  const db = getDb();
  for (const u of db.users) {
    if (u.roles.includes("ADMIN") || u.roles.includes("SUPER_ADMIN")) {
      notify(u.id, type, title, body);
    }
  }
}

/* --------------------------------------------------------------- ไฟล์แนบ (mock) */

interface StoredFile {
  fileName: string;
  mimeType: string;
  byteSize: number;
  blob: Blob;
}

const attachmentStore = new Map<string, StoredFile>();

export function putAttachment(file: File): { id: string; fileName: string; mimeType: string; byteSize: number } {
  const id = newId("att");
  const mimeType = file.type || "application/octet-stream";
  attachmentStore.set(id, { fileName: file.name, mimeType, byteSize: file.size, blob: file });
  return { id, fileName: file.name, mimeType, byteSize: file.size };
}

export function getAttachmentMeta(id: string): StoredFile | undefined {
  return attachmentStore.get(id);
}

export function getAttachmentBlob(id: string): Blob {
  const found = attachmentStore.get(id);
  if (!found) throw new Error("ไม่พบไฟล์แนบ (ไฟล์จำลองจะหายเมื่อรีเฟรชหน้า)");
  return found.blob;
}
