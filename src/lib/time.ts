/**
 * เครื่องมือจัดการเวลา — ยึด Asia/Bangkok เสมอ (plan001.md §11.2)
 *
 * ห้ามใช้ new Date() แบบอิงโซนเวลาเครื่องผู้ใช้ในการคำนวณ slot
 * ทุกฟังก์ชันในไฟล์นี้แปลงเป็นเวลาไทยด้วย offset คงที่ +07:00 ก่อนเสมอ
 * ("dateKey" = สตริงวันที่แบบ YYYY-MM-DD ตามปฏิทินไทย)
 */

export const BKK_OFFSET_MINUTES = 7 * 60;
export const BKK_OFFSET = "+07:00";

const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const TH_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TH_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/** ทำให้เป็น "หน้าปัดเวลาไทย" แล้วอ่านค่าด้วยเมธอด UTC ได้ตรง ๆ */
function bkkClock(iso: string | number | Date): Date {
  const ms = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  return new Date(ms + BKK_OFFSET_MINUTES * MS_MIN);
}

/** ประกอบ ISO string ที่มี offset จากวันที่ + เวลาไทย */
export function toIso(dateKey: string, hhmm: string): string {
  return `${dateKey}T${hhmm.length === 5 ? hhmm : hhmm.slice(0, 5)}:00${BKK_OFFSET}`;
}

export function dateKeyOf(iso: string | Date): string {
  return bkkClock(iso).toISOString().slice(0, 10);
}

export function hhmmOf(iso: string | Date): string {
  return bkkClock(iso).toISOString().slice(11, 16);
}

/** นาทีนับจากเที่ยงคืนของวันนั้น (เวลาไทย) */
export function minutesOfDay(iso: string | Date): number {
  const c = bkkClock(iso);
  return c.getUTCHours() * 60 + c.getUTCMinutes();
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function weekdayOf(dateKey: string): number {
  return bkkClock(toIso(dateKey, "12:00")).getUTCDay();
}

export function isWeekend(dateKey: string): boolean {
  const d = weekdayOf(dateKey);
  return d === 0 || d === 6;
}

export function addDays(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T00:00:00Z`).getTime() + days * MS_DAY;
  return new Date(base).toISOString().slice(0, 10);
}

export function diffDays(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T00:00:00Z`).getTime();
  const b = new Date(`${toKey}T00:00:00Z`).getTime();
  return Math.round((b - a) / MS_DAY);
}

/** วันที่วันนี้ตามเวลาไทย */
export function todayKey(now: number = Date.now()): string {
  return dateKeyOf(new Date(now));
}

export function nowHhmm(now: number = Date.now()): string {
  return hhmmOf(new Date(now));
}

export function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function daysInMonth(dateKey: string): number {
  const [y, m] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(dateKey: string, n: number): string {
  const [y, m] = dateKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/* ---------- การแสดงผลภาษาไทย ---------- */

export function thaiDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${TH_DAYS[weekdayOf(dateKey)]}ที่ ${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}

export function thaiDateMedium(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}

export function thaiDateShort(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${d} ${TH_MONTHS_SHORT[m - 1]}`;
}

export function thaiWeekdayShort(dateKey: string): string {
  return TH_DAYS_SHORT[weekdayOf(dateKey)];
}

export function thaiWeekdayLong(dateKey: string): string {
  return TH_DAYS[weekdayOf(dateKey)];
}

export function thaiMonthYear(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}

export const THAI_WEEKDAY_HEADERS = TH_DAYS_SHORT;

/** ช่วงเวลา 09:00–16:30 */
export function rangeLabel(startIso: string, endIso: string): string {
  return `${hhmmOf(startIso)}–${hhmmOf(endIso)}`;
}

export function durationLabel(startIso: string, endIso: string): string {
  const mins = (new Date(endIso).getTime() - new Date(startIso).getTime()) / MS_MIN;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} ชม. ${m} น.`;
  if (h) return `${h} ชั่วโมง`;
  return `${m} นาที`;
}

/** ทับซ้อนกันหรือไม่ — ปลายเปิด: จบพอดีตอนอีกอันเริ่ม ไม่ถือว่าชน */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime()
    && new Date(bStart).getTime() < new Date(aEnd).getTime();
}

/** สร้างรายการเวลาทุก ๆ step นาที ตั้งแต่ open ถึง close */
export function timeOptions(open: string, close: string, step: number): string[] {
  const out: string[] = [];
  for (let m = hhmmToMinutes(open); m <= hhmmToMinutes(close); m += step) {
    out.push(minutesToHhmm(m));
  }
  return out;
}

export function relativeDayLabel(dateKey: string, today: string): string | null {
  const d = diffDays(today, dateKey);
  if (d === 0) return "วันนี้";
  if (d === 1) return "พรุ่งนี้";
  if (d === 2) return "มะรืนนี้";
  if (d === -1) return "เมื่อวาน";
  return null;
}
