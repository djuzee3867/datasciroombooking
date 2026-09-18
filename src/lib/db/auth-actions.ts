/**
 * Actions ของการเข้าสู่ระบบ — รุ่น UI ล้วน (mock)
 *
 * ไม่มีรหัสผ่านจริง ไม่มี OTP จริง ไม่มี Google/SSO จริง —
 * ทุกอย่างจำลองบนก้อน Db ในหน่วยความจำเพื่อให้หน้าจอ auth ทั้งหมดใช้งานได้เป็นเดโม
 *
 *   • เข้าสู่ระบบ: จับคู่อีเมลกับผู้ใช้ในข้อมูลตัวอย่าง แล้วตั้งเซสชันจำลอง
 *   • สมัคร + OTP: สร้างผู้ใช้ใหม่ · รหัส OTP สำหรับทดสอบคือ 000000 (กรอกเลข 6 หลักใดก็ผ่าน)
 *
 * ลายเซ็นของฟังก์ชันเหมือนรุ่นจริง หน้าจอ login/signup/otp จึงไม่ต้องแก้
 */

import { getDb, newId, setSessionUser, getSessionUserId } from "./mockdb";
import type { Role } from "../types";

/* ------------------------------------------------------------ ชนิดข้อมูล */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  department: string;
}

export interface AuthResult {
  ok: boolean;
  message?: string;
  needsVerification?: boolean;
  otpMinutes?: number;
  devCode?: string;
  needsProfile?: boolean;
}

export interface AuthStatus {
  user: SessionUser | null;
  profileComplete: boolean;
  googleEnabled: boolean;
  mailEnabled: boolean;
}

export interface ProfileUpdate {
  firstName: string;
  lastName: string;
  phone: string;
  department: string;
}

/* ------------------------------------------------------------- ตัวช่วย */

const cleanEmail = (v: string) => v.trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEV_OTP = "000000";
const OTP_MINUTES = 10;

const fullName = (first: string, last: string) => `${first.trim()} ${last.trim()}`.trim();
const isUniversityEmail = (email: string) => /\.ac\.th$/i.test(email);
const profileComplete = (u: { phone?: string; department: string }) =>
  Boolean(u.phone && u.phone.trim() && u.department && u.department.trim());

function validateProfile(input: Omit<SignUpInput, "password">): string | null {
  if (!EMAIL_RE.test(cleanEmail(input.email))) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (!input.firstName.trim()) return "กรุณากรอกชื่อ";
  if (!input.lastName.trim()) return "กรุณากรอกนามสกุล";
  const phone = input.phone.replace(/[\s-]/g, "");
  if (!/^0\d{8,9}$/.test(phone)) return "รูปแบบหมายเลขโทรศัพท์ไม่ถูกต้อง";
  if (!input.department.trim()) return "กรุณาระบุหน่วยงานหรือสังกัด";
  return null;
}

/* --------------------------------------------------------------- สมัคร */

export async function signUpAction(input: SignUpInput): Promise<AuthResult> {
  const email = cleanEmail(input.email);
  const problem = validateProfile(input);
  if (problem) return { ok: false, message: problem };
  if (input.password.length < 8) return { ok: false, message: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว" };

  const db = getDb();
  const existing = db.users.find((u) => u.email.toLowerCase() === email);
  if (existing && (existing.phone || existing.department)) {
    return { ok: false, message: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ" };
  }

  const roles: Role[] = isUniversityEmail(email) ? ["USER"] : ["GUEST"];
  if (existing) {
    existing.name = fullName(input.firstName, input.lastName);
    existing.phone = input.phone.trim();
    existing.department = input.department.trim();
  } else {
    db.users.push({
      id: newId("u"),
      name: fullName(input.firstName, input.lastName),
      email,
      department: input.department.trim(),
      roles,
      phone: input.phone.trim(),
    });
  }

  return {
    ok: true,
    needsVerification: true,
    otpMinutes: OTP_MINUTES,
    devCode: DEV_OTP,
    message: `ส่งรหัสยืนยัน 6 หลักไปที่ ${email} แล้ว`,
  };
}

export async function verifyEmailAction(email: string, code: string): Promise<AuthResult> {
  const mail = cleanEmail(email);
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, needsVerification: true, message: "กรุณากรอกรหัส 6 หลัก" };
  }
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === mail);
  if (!user) return { ok: false, message: "ไม่พบบัญชีนี้" };
  setSessionUser(user.id);
  return { ok: true, needsProfile: !profileComplete(user) };
}

export async function resendOtpAction(_email: string): Promise<AuthResult> {
  return {
    ok: true,
    needsVerification: true,
    otpMinutes: OTP_MINUTES,
    devCode: DEV_OTP,
    message: "ส่งรหัสใหม่ให้แล้ว",
  };
}

/* ------------------------------------------------------------ เข้าระบบ */

export async function loginAction(email: string, _password: string): Promise<AuthResult> {
  const mail = cleanEmail(email);
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === mail);
  if (!user) {
    return {
      ok: false,
      message: "ไม่พบบัญชีนี้ในข้อมูลตัวอย่าง — ใช้ปุ่มเข้าสู่ระบบด่วน หรือกดสมัครสมาชิก",
    };
  }
  setSessionUser(user.id);
  return { ok: true, needsProfile: !profileComplete(user) };
}

export async function logoutAction(): Promise<void> {
  setSessionUser(null);
}

/* ------------------------------------------------- ข้อมูลติดต่อให้ครบ */

export async function completeProfileAction(input: ProfileUpdate): Promise<AuthResult> {
  const id = getSessionUserId();
  if (!id) return { ok: false, message: "กรุณาเข้าสู่ระบบก่อน" };
  const problem = validateProfile({ ...input, email: "x@x.ac.th" });
  if (problem) return { ok: false, message: problem };

  const db = getDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return { ok: false, message: "ไม่พบบัญชีนี้" };
  user.name = fullName(input.firstName, input.lastName);
  user.phone = input.phone.trim();
  user.department = input.department.trim();
  return { ok: true };
}

/* ------------------------------------------------------------- สถานะ */


export async function authStatusAction(): Promise<AuthStatus> {
  const id = getSessionUserId();
  const user = id ? getDb().users.find((u) => u.id === id) ?? null : null;
  return {
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    profileComplete: user ? profileComplete(user) : false,
    // รุ่น UI ล้วนไม่มี Google/เมลจริง จึงปิดไว้ทั้งคู่
    googleEnabled: false,
    mailEnabled: false,
  };
}
