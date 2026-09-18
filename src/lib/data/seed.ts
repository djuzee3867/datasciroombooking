/**
 * ข้อมูลจำลอง (รุ่น UI ล้วน)
 *
 * เหลือ 3 ห้อง: SCB4101 / SCB4102 (ห้องเมเจอร์ Data Science) และ SCB4203 (ห้อง DSRC)
 * มี 3 บทบาท: ผู้ใช้ทั่วไป (USER) · แอดมิน (ADMIN) · ผู้ดูแลระบบ (SUPER_ADMIN)
 *
 * ทุกอย่างสร้างจาก "วันนี้" เพื่อให้ตารางมีข้อมูลรอบ ๆ วันปัจจุบันเสมอ
 */

import type {
  Blackout, Booking, BookingCategory, BookingSpace, BookableUnit, Building,
  Db, Equipment, Floor, Handoff, Holiday, RoomManagerAssignment, Space, Term, User,
} from "../types";
import { addDays, toIso } from "../time";

/* PRNG แบบกำหนดค่าได้ เพื่อให้ข้อมูลจำลองเหมือนเดิมทุกครั้ง */
function makeRng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const EQUIPMENT: Equipment[] = [
  { id: "eq-projector", name: "โปรเจกเตอร์", icon: "projector" },
  { id: "eq-tv", name: "จอ TV ขนาดใหญ่", icon: "tv" },
  { id: "eq-mic", name: "ชุดไมค์ประชุม", icon: "mic" },
  { id: "eq-sound", name: "ระบบเสียงกลาง", icon: "sound" },
  { id: "eq-whiteboard", name: "ไวท์บอร์ด", icon: "board" },
  { id: "eq-computer", name: "คอมพิวเตอร์ประจำห้อง", icon: "computer" },
  { id: "eq-aircon", name: "เครื่องปรับอากาศ", icon: "aircon" },
  { id: "eq-camera", name: "กล้องประชุมออนไลน์", icon: "camera" },
  { id: "eq-hdmi", name: "ช่องต่อ HDMI / USB-C", icon: "hdmi" },
  { id: "eq-podium", name: "โพเดียมบรรยาย", icon: "podium" },
];

const BUILDINGS: Building[] = [
  { id: "bld-scb4", code: "SCB4", name: "อาคาร SCB4 — คณะวิทยาศาสตร์ข้อมูล", isActive: true },
];

const FLOORS: Floor[] = [
  { id: "fl-1", buildingId: "bld-scb4", floorNo: 1, name: "ชั้น 1 — ห้องเรียนเมเจอร์" },
  { id: "fl-2", buildingId: "bld-scb4", floorNo: 2, name: "ชั้น 2 — ศูนย์วิจัย DSRC" },
];

/** พื้นที่จริงที่แบ่งไม่ได้ — หน่วยตรวจการชน */
const SPACE_CODES: Record<string, string[]> = {
  "fl-1": ["SCB4101", "SCB4102"],
  "fl-2": ["SCB4203"],
};

const SPACES: Space[] = Object.entries(SPACE_CODES).flatMap(([floorId, codes]) =>
  codes.map((code) => ({ id: `sp-${code}`, floorId, code })),
);

type UnitSeed = Omit<BookableUnit, "id"> & { spaces: string[] };

const UNIT_SEEDS: UnitSeed[] = [
  {
    floorId: "fl-1", code: "SCB4101", name: "ห้องเมเจอร์ Data Science 1", capacity: 60,
    isBookable: true, openToGuest: true, bookingHoursOverride: null,
    description: "ห้องเรียนหลักของเมเจอร์วิทยาการข้อมูล จัดโต๊ะแบบ Theatre พร้อมโปรเจกเตอร์และระบบเสียง เหมาะกับการเรียนการสอนและบรรยายรวม",
    contactNote: "รับกุญแจที่ห้องธุรการชั้น 1 ก่อนเวลาใช้งาน 15 นาที",
    roomType: "ห้องเรียนเมเจอร์", images: ["a", "b", "c"],
    equipmentIds: ["eq-projector", "eq-mic", "eq-sound", "eq-computer", "eq-aircon", "eq-podium"],
    spaces: ["SCB4101"],
  },
  {
    floorId: "fl-1", code: "SCB4102", name: "ห้องเมเจอร์ Data Science 2", capacity: 45,
    isBookable: true, openToGuest: true, bookingHoursOverride: null,
    description: "ห้องปฏิบัติการ/ห้องเรียนของเมเจอร์วิทยาการข้อมูล ติดตั้งเครื่องคอมพิวเตอร์และชุดซอฟต์แวร์วิเคราะห์ข้อมูล เหมาะกับ workshop เชิงปฏิบัติ",
    contactNote: "แจ้งรายการซอฟต์แวร์ที่ต้องใช้ล่วงหน้าอย่างน้อย 3 วัน",
    roomType: "ห้องปฏิบัติการ", images: ["b", "c", "a"],
    equipmentIds: ["eq-projector", "eq-computer", "eq-whiteboard", "eq-aircon", "eq-hdmi"],
    spaces: ["SCB4102"],
  },
  {
    floorId: "fl-2", code: "SCB4203", name: "ห้อง DSRC", capacity: 24,
    isBookable: true, openToGuest: false, bookingHoursOverride: null,
    description: "Data Science Research Center — ห้องประชุม/สัมมนาของศูนย์วิจัย รองรับการประชุมไฮบริดพร้อมจอ TV และกล้องประชุมออนไลน์",
    contactNote: "ติดต่อผู้ประสานงานศูนย์วิจัยเพื่อประสานการใช้งาน",
    roomType: "ห้องวิจัย / ประชุม", images: ["c", "a"],
    equipmentIds: ["eq-tv", "eq-camera", "eq-mic", "eq-whiteboard", "eq-aircon", "eq-hdmi"],
    spaces: ["SCB4203"],
  },
];

const USERS: User[] = [
  { id: "u-me", name: "ณัฐพล ศรีสวัสดิ์", email: "natthapon.s@example.ac.th", department: "ภาควิชาวิทยาการข้อมูล", roles: ["USER"], phone: "081-234-5678" },
  { id: "u-admin", name: "ปรียา ชัยวัฒน์", email: "preeya.c@example.ac.th", department: "ฝ่ายอาคารและสถานที่", roles: ["USER", "ADMIN"], phone: "02-123-4501" },
  { id: "u-super", name: "ทีมพัฒนาระบบ", email: "it-admin@example.ac.th", department: "ฝ่ายเทคโนโลยีสารสนเทศ", roles: ["USER", "ADMIN", "SUPER_ADMIN"], phone: "02-123-4599" },
  { id: "u-a1", name: "ผศ.ดร. กนกวรรณ ธีรกุล", email: "kanokwan.t@example.ac.th", department: "ภาควิชาสถิติ", roles: ["USER"], phone: "081-111-2222" },
  { id: "u-a2", name: "รศ.ดร. วิชัย เจริญพงษ์", email: "wichai.j@example.ac.th", department: "ภาควิชาวิทยาการข้อมูล", roles: ["USER"], phone: "081-333-4444" },
  { id: "u-a3", name: "สุนิสา แก้วใจ", email: "sunisa.k@example.ac.th", department: "งานกิจการนักศึกษา", roles: ["USER"], phone: "081-555-6666" },
  { id: "u-a4", name: "ธนกฤต อินทรีย์", email: "thanakrit.i@example.ac.th", department: "สโมสรนักศึกษา", roles: ["USER"], phone: "081-777-8888" },
];

/** รุ่นนี้ยังไม่แบ่งบทบาทผู้ดูแลห้อง — เว้นว่างไว้ */
const ROOM_MANAGERS: RoomManagerAssignment[] = [];

/* แม่แบบรายการจองจำลอง */
const TEMPLATES: {
  title: string; category: BookingCategory; purpose: string; owner: string; size: number;
}[] = [
  { title: "STAT1", category: "CLASS", purpose: "สอนวิชาสถิติเบื้องต้น หมู่เรียนที่ 1", owner: "u-a1", size: 50 },
  { title: "DATA201", category: "CLASS", purpose: "ปฏิบัติการวิเคราะห์ข้อมูลด้วย Python", owner: "u-a2", size: 38 },
  { title: "ประชุมภาควิชา", category: "MEETING", purpose: "ประชุมคณะกรรมการประจำภาควิชา ครั้งที่ 9", owner: "u-a2", size: 18 },
  { title: "อบรม Data Viz", category: "TRAINING", purpose: "อบรมเชิงปฏิบัติการการทำ Data Visualization", owner: "u-a1", size: 40 },
  { title: "สอบกลางภาค", category: "EXAM", purpose: "สอบกลางภาควิชา DATA101", owner: "u-a1", size: 55 },
  { title: "ประชุมสโมสรนักศึกษา", category: "MEETING", purpose: "ประชุมเตรียมงานกีฬาสีประจำปี", owner: "u-a4", size: 20 },
  { title: "สัมมนาวิทยานิพนธ์", category: "MEETING", purpose: "นำเสนอความก้าวหน้าวิทยานิพนธ์ระดับบัณฑิตศึกษา", owner: "u-a2", size: 15 },
  { title: "กิจกรรมชมรม", category: "ACTIVITY", purpose: "กิจกรรมชมรมวิทยาการข้อมูลประจำสัปดาห์", owner: "u-a4", size: 22 },
];

const SLOT_PATTERNS: [string, string][] = [
  ["08:00", "10:00"], ["08:30", "12:00"], ["09:00", "12:00"], ["09:00", "16:30"],
  ["10:00", "11:30"], ["13:00", "16:00"], ["13:30", "15:00"], ["14:00", "17:00"],
  ["15:00", "18:00"], ["09:30", "13:00"],
];

/** สร้างฐานข้อมูลจำลองทั้งชุด อ้างอิงจากวันที่วันนี้ */
export function createSeed(today: string): Db {
  const rng = makeRng("scb4-seed-v2");

  const bookableUnits: BookableUnit[] = UNIT_SEEDS.map((u) => ({
    id: `unit-${u.code}`,
    floorId: u.floorId,
    code: u.code,
    name: u.name,
    capacity: u.capacity,
    isBookable: u.isBookable,
    openToGuest: u.openToGuest,
    bookingHoursOverride: u.bookingHoursOverride,
    description: u.description,
    contactNote: u.contactNote,
    unbookableReason: u.unbookableReason,
    roomType: u.roomType,
    images: u.images,
    equipmentIds: u.equipmentIds,
  }));

  const unitSpaces = UNIT_SEEDS.flatMap((u) =>
    u.spaces.map((code) => ({ unitId: `unit-${u.code}`, spaceId: `sp-${code}` })),
  );

  const bookableCodes = UNIT_SEEDS.filter((u) => u.isBookable).map((u) => u.code);

  const bookings: Booking[] = [];
  const bookingSpaces: BookingSpace[] = [];
  const handoffs: Handoff[] = [];
  const approvals: Db["approvals"] = [];

  const pushBooking = (b: Booking) => {
    bookings.push(b);
    const spaceIds = unitSpaces.filter((us) => us.unitId === b.unitId).map((us) => us.spaceId);
    for (const spaceId of spaceIds) {
      bookingSpaces.push({ bookingId: b.id, spaceId, startAt: b.startAt, endAt: b.endAt });
    }
  };

  let n = 0;
  // ข้อมูลย้อนหลัง 30 วัน ถึงล่วงหน้า 35 วัน
  for (let offset = -30; offset <= 35; offset++) {
    const dateKey = addDays(today, offset);
    const wd = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
    const density = wd === 0 || wd === 6 ? 0.25 : 1;
    const count = Math.round((1 + rng() * 2.2) * density);

    const usedPerRoom = new Map<string, [number, number][]>();

    for (let i = 0; i < count; i++) {
      const code = bookableCodes[Math.floor(rng() * bookableCodes.length)];
      const tpl = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
      const [start, end] = SLOT_PATTERNS[Math.floor(rng() * SLOT_PATTERNS.length)];
      const sMin = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
      const eMin = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));

      const used = usedPerRoom.get(code) ?? [];
      if (used.some(([a, b]) => sMin < b && a < eMin)) continue;
      used.push([sMin, eMin]);
      usedPerRoom.set(code, used);

      const unit = bookableUnits.find((u) => u.code === code)!;
      if (tpl.size > unit.capacity) continue;

      n++;
      const id = `bk-${String(n).padStart(4, "0")}`;
      let status: Booking["status"];
      if (offset < 0) status = rng() < 0.08 ? "CANCELLED_BY_USER" : "COMPLETED";
      else if (offset === 0) status = "APPROVED";
      else if (offset <= 4) status = rng() < 0.3 ? "PENDING" : "APPROVED";
      else status = rng() < 0.45 ? "PENDING" : "APPROVED";

      const booking: Booking = {
        id,
        seriesId: null,
        unitId: unit.id,
        ownerId: tpl.owner,
        startAt: toIso(dateKey, start),
        endAt: toIso(dateKey, end),
        publicTitle: tpl.title,
        category: tpl.category,
        purpose: tpl.purpose,
        attendeeCount: tpl.size,
        contactPhone: USERS.find((u) => u.id === tpl.owner)?.phone ?? "02-123-4500",
        attachmentName: null,
        attachmentId: null,
        attachmentMime: null,
        attachmentSize: null,
        note: "",
        status,
        createdAt: toIso(addDays(dateKey, -7), "09:15"),
        outsideHours: false,
      };
      pushBooking(booking);

      if (status === "APPROVED" || status === "COMPLETED") {
        approvals.push({
          id: `ap-${id}`, bookingId: id, decidedBy: "u-admin",
          decision: "APPROVED", reason: "", decidedAt: toIso(addDays(dateKey, -5), "10:00"),
        });
        handoffs.push({
          id: `hd-${id}`, bookingId: id, roomManagerId: null,
          notifiedAt: toIso(addDays(dateKey, -5), "10:01"),
          acknowledgedAt: rng() < 0.6 ? toIso(addDays(dateKey, -4), "08:30") : null,
          note: "",
        });
      }
    }
  }

  // รายการของผู้ดูแลระบบ (ผู้ใช้เริ่มต้นในโหมดเดโม) เพื่อให้หน้า "การจองของฉัน" มีของให้ดู
  const mine: [number, string, string, string, string, BookingCategory, Booking["status"]][] = [
    [5, "unit-SCB4203", "13:00", "15:00", "ประชุมทีมวิจัย DSRC", "MEETING", "PENDING"],
    [2, "unit-SCB4101", "09:00", "12:00", "DATA201", "CLASS", "APPROVED"],
    [-6, "unit-SCB4102", "10:00", "11:30", "ประชุมทีมพัฒนาระบบ", "MEETING", "COMPLETED"],
    [9, "unit-SCB4101", "18:30", "20:00", "อบรมนอกเวลา", "TRAINING", "PENDING"],
  ];
  for (const [offset, unitId, s, e, title, category, status] of mine) {
    const dateKey = addDays(today, offset);
    const spaceIds = unitSpaces.filter((us) => us.unitId === unitId).map((x) => x.spaceId);
    const conflict = bookingSpaces.some(
      (bs) =>
        spaceIds.includes(bs.spaceId)
        && new Date(toIso(dateKey, s)) < new Date(bs.endAt)
        && new Date(bs.startAt) < new Date(toIso(dateKey, e)),
    );
    if (conflict) continue;

    n++;
    const id = `bk-${String(n).padStart(4, "0")}`;
    const unit = bookableUnits.find((u) => u.id === unitId)!;
    pushBooking({
      id, seriesId: null, unitId, ownerId: "u-super",
      startAt: toIso(dateKey, s), endAt: toIso(dateKey, e),
      publicTitle: title, category,
      purpose: "งานของหน่วยงานต้นสังกัด", attendeeCount: Math.min(12, unit.capacity),
      contactPhone: "02-123-4599",
      attachmentName: offset === 9 ? "หนังสือขออนุญาตใช้ห้องนอกเวลา.pdf" : null,
      attachmentId: null, attachmentMime: null, attachmentSize: null,
      note: "", status,
      createdAt: toIso(addDays(today, -2), "14:20"),
      outsideHours: offset === 9,
    });
    if (status === "APPROVED" || status === "COMPLETED") {
      approvals.push({
        id: `ap-${id}`, bookingId: id, decidedBy: "u-admin", decision: "APPROVED",
        reason: "", decidedAt: toIso(addDays(today, -1), "09:00"),
      });
      handoffs.push({
        id: `hd-${id}`, bookingId: id, roomManagerId: null,
        notifiedAt: toIso(addDays(today, -1), "09:01"),
        acknowledgedAt: toIso(addDays(today, -1), "11:00"),
        note: "เตรียมห้องและอุปกรณ์เรียบร้อยแล้ว",
      });
    }
  }

  const blackouts: Blackout[] = [
    {
      id: "bo-1", spaceId: "sp-SCB4102",
      startAt: toIso(addDays(today, 6), "08:00"), endAt: toIso(addDays(today, 6), "18:00"),
      reason: "ปิดปรับปรุงระบบไฟฟ้าและเปลี่ยนเครื่องคอมพิวเตอร์", createdBy: "u-admin",
    },
    {
      id: "bo-2", spaceId: "sp-SCB4203",
      startAt: toIso(addDays(today, 12), "13:00"), endAt: toIso(addDays(today, 12), "18:00"),
      reason: "ล้างเครื่องปรับอากาศประจำปี", createdBy: "u-admin",
    },
  ];

  const terms: Term[] = [
    { id: "term-1-2569", name: "ภาคการศึกษาที่ 1/2569", startDate: addDays(today, -20), endDate: addDays(today, 100) },
    { id: "term-2-2569", name: "ภาคการศึกษาที่ 2/2569", startDate: addDays(today, 130), endDate: addDays(today, 250) },
  ];

  const holidays: Holiday[] = [
    { date: addDays(today, 4), name: "วันหยุดชดเชย" },
    { date: addDays(today, 17), name: "วันหยุดนักขัตฤกษ์" },
    { date: addDays(today, 31), name: "วันหยุดประจำภาคการศึกษา" },
  ];

  return {
    users: USERS,
    buildings: BUILDINGS,
    floors: FLOORS,
    spaces: SPACES,
    bookableUnits,
    unitSpaces,
    equipment: EQUIPMENT,
    roomManagers: ROOM_MANAGERS,
    terms,
    holidays,
    bookingSeries: [],
    bookings,
    bookingSpaces,
    blackouts,
    approvals,
    handoffs,
    auditLogs: [],
    notifications: [],
  };
}
