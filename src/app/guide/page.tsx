"use client";

/** คู่มือการใช้งาน — รวมกติกาทั้งหมดไว้ที่เดียว โดยอ่านค่าจาก POLICY เสมอ */

import { useState } from "react";
import Link from "next/link";
import { POLICY, ROLE_LABEL, bookingTerms } from "@/lib/policy";
import { PageShell, PageHeading } from "@/components/layout/SiteShell";
import { Badge, ButtonLink, Card, CardHeader, Notice, cx } from "@/components/ui/primitives";
import {
  IconBook, IconCalendarPlus, IconCheck, IconChevronDown, IconClock,
  IconLock, IconShield, IconUsers, IconWarn, IconX,
} from "@/components/ui/icons";

const STEPS = [
  {
    title: "ดูตารางห้องก่อนตัดสินใจ",
    body: "หน้าแรกแสดงห้องทั้งหมดพร้อมตารางเวลารายวัน ไม่ต้องล็อกอินก็ดูได้ · กดแผนผังชั้นเพื่อดูว่าห้องไหนอยู่ตรงไหนและว่างหรือไม่",
  },
  {
    title: "เข้าสู่ระบบ",
    body: "สมัครด้วยอีเมล + รหัสผ่าน แล้วยืนยันตัวตนด้วยรหัส OTP ที่ส่งไปทางอีเมล หรือกด “ดำเนินการต่อด้วย Google” ก็ได้ · อีเมลของมหาวิทยาลัยจะได้สิทธิ์จองเต็มรูปแบบ อีเมลอื่นเป็นบุคคลภายนอกและจองได้เฉพาะห้องที่เปิดให้ · การเข้าผ่าน SSO ของมหาวิทยาลัยจะเปิดใช้เมื่อฝ่ายไอทีเชื่อมระบบให้แล้ว",
  },
  {
    title: "เลือกตึก → ห้อง → กรอกรายละเอียด",
    body: "หน้าจองแบ่งเป็น 3 ขั้นตอน ระบบจะแสดงตารางของห้องพร้อมวาดช่วงเวลาที่คุณกำลังเลือกทับลงไป ทำให้เห็นทันทีว่าชนกับใครหรือไม่",
  },
  {
    title: "รอแอดมินอนุมัติ",
    body: "คำขอจะกันเวลาไว้ให้ทันทีเพื่อกันคนอื่นจองซ้อน · แอดมินพิจารณาแล้วจะแจ้งผลกลับ หากถูกปฏิเสธ ระบบจะปล่อยเวลาคืนอัตโนมัติ เมื่ออนุมัติแล้วถือว่าการจองสมบูรณ์",
  },
];

const FAQ = [
  {
    q: "จองวันเสาร์–อาทิตย์หรือวันหยุดได้ไหม",
    a: "ได้ตามปกติ ระบบเปิดให้จองทุกวัน วันหยุดมีเพียงป้ายกำกับบนปฏิทินเพื่อให้ทราบเท่านั้น ไม่ได้ปิดการจอง",
  },
  {
    q: `ทำไมจองวันนี้หรือพรุ่งนี้ไม่ได้`,
    a: `ระบบกำหนดให้จองล่วงหน้าอย่างน้อย ${POLICY.leadTimeDays} วัน นับเป็นวันปฏิทิน (ไม่ตัดเสาร์–อาทิตย์และวันหยุดออก) ปฏิทินจึงเริ่มเลือกได้จากวันแรกที่จองได้จริง · กรณีเร่งด่วนต้องให้แอดมินจองแทรกให้`,
  },
  {
    q: "ต้องการใช้ห้องนอกเวลาให้บริการทำอย่างไร",
    a: `เลือกเวลานอกช่วง ${POLICY.openTime}–${POLICY.closeTime} น. ได้เลย ระบบจะเตือนบนหน้าจอทันทีและบังคับให้แนบเอกสารเพิ่มเติม จากนั้นแอดมินจะพิจารณาเป็นกรณีไป`,
  },
  {
    q: "ห้องเลข 4305-6 คืออะไร ต่างจาก 4305 อย่างไร",
    a: "คือห้อง 4305 และ 4306 ที่เปิดผนังกั้นรวมเป็นห้องเดียว ระบบตรวจการชนที่ระดับพื้นที่จริง ดังนั้นการจองห้องรวมจะทำให้ห้องย่อยทั้งสองไม่ว่างโดยอัตโนมัติ และในทางกลับกันด้วย",
  },
  {
    q: "จองได้ครั้งละกี่ชั่วโมง มีโควตาไหม",
    a: `จองยาวเท่าไหร่ก็ได้ภายในเวลาให้บริการของวันนั้น ขั้นต่ำ ${POLICY.minDurationMinutes} นาที และไม่มีโควตาชั่วโมงต่อผู้ใช้ · หากต้องใช้ข้ามวันให้สร้างรายการแยกของแต่ละวัน`,
  },
  {
    q: "ยกเลิกได้ถึงเมื่อไหร่",
    a: `ยกเลิกผ่านระบบได้ล่วงหน้าอย่างน้อย ${POLICY.cancelNoticeHours} ชั่วโมงก่อนเวลาเริ่ม · หลังจากนั้นต้องติดต่อแอดมินโดยตรง`,
  },
  {
    q: "คนอื่นเห็นข้อมูลอะไรของฉันบ้าง",
    a: "ผู้ที่ไม่ล็อกอินเห็นเฉพาะช่วงเวลา ชื่อเรื่องสาธารณะ และประเภทการใช้งานเท่านั้น · ชื่อผู้จอง เบอร์โทร วัตถุประสงค์ จำนวนผู้เข้าร่วม และเอกสารแนบ เป็นข้อมูลภายใน",
  },
  {
    q: "ใครเป็นคนอนุมัติคำขอ",
    a: "แอดมิน (ฝ่ายอาคาร) เป็นผู้พิจารณาอนุมัติคำขอทั้งหมด",
  },
];

const PERMISSIONS: { action: string; cells: (boolean | string)[] }[] = [
  { action: "ดูตารางห้อง (เวลา + ชื่อเรื่อง)", cells: [true, true, true, true, true] },
  { action: "ดูรายละเอียดผู้จอง", cells: [false, false, "เฉพาะของตน", true, true] },
  { action: "สร้างคำขอจอง", cells: [false, "เฉพาะห้องสาธารณะ", true, true, true] },
  { action: "แก้ไข/ยกเลิกคำขอของตัวเอง", cells: [false, true, true, true, true] },
  { action: "แก้ไข/ยกเลิกคำขอของคนอื่น", cells: [false, false, false, true, true] },
  { action: "อนุมัติ / ปฏิเสธคำขอ", cells: [false, false, false, true, true] },
  { action: "บล็อกเวลาห้อง", cells: [false, false, false, true, true] },
  { action: "เพิ่ม/แก้ไข/ปิดห้อง", cells: [false, false, false, true, true] },
  { action: "ตั้งค่าเทอม / วันหยุด / นโยบาย", cells: [false, false, false, true, true] },
  { action: "กำหนด role ผู้ใช้", cells: [false, false, false, false, true] },
  { action: "ดู Audit log", cells: [false, false, false, true, true] },
];

const ROLE_COLS = ["VIEWER", "GUEST", "USER", "ADMIN", "SUPER_ADMIN"] as const;

export default function GuidePage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <PageShell>
      <PageHeading
        eyebrow="คู่มือการใช้งาน"
        title="ใช้ระบบจองห้อง SCB4 อย่างไร"
        description="รวมขั้นตอนการจอง กติกาทั้งหมด และสิทธิ์ของแต่ละบทบาทไว้ที่เดียว"
        action={<ButtonLink href="/book"><IconCalendarPlus className="h-4 w-4" /> เริ่มจองห้อง</ButtonLink>}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* ขั้นตอน */}
        <Card>
          <CardHeader icon={<IconBook className="h-4.5 w-4.5" />} title="ขั้นตอนการจองห้อง" />
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 pb-1">
                  <p className="font-semibold text-ink-900">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* กติกาสำคัญ */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { Icon: IconClock, label: "เวลาให้บริการ", value: `${POLICY.openTime}–${POLICY.closeTime} น.`, hint: "นอกเวลานี้จองได้ แต่ต้องแนบเอกสาร" },
            { Icon: IconCalendarPlus, label: "จองล่วงหน้า", value: `อย่างน้อย ${POLICY.leadTimeDays} วัน`, hint: `ไกลสุด ${POLICY.bookingHorizonDays} วัน` },
            { Icon: IconX, label: "ยกเลิกล่วงหน้า", value: `${POLICY.cancelNoticeHours} ชั่วโมง`, hint: "หลังจากนั้นติดต่อแอดมิน" },
            { Icon: IconClock, label: "หน่วยเวลา", value: `${POLICY.slotMinutes} นาที`, hint: `ขั้นต่ำ ${POLICY.minDurationMinutes} นาที · ไม่จำกัดสูงสุด` },
            { Icon: IconUsers, label: "โควตาต่อผู้ใช้", value: "ไม่จำกัด", hint: "จองได้ตามที่จำเป็นจริง" },
            { Icon: IconShield, label: "การอนุมัติ", value: "แอดมินเป็นผู้อนุมัติ", hint: `พิจารณาภายใน ${POLICY.pendingExpiryHours} ชั่วโมง` },
          ].map(({ Icon, label, value, hint }) => (
            <div key={label} className="rounded-2xl border border-ink-100 bg-white p-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 text-xs font-medium text-ink-400">{label}</p>
              <p className="mt-0.5 font-semibold text-ink-900">{value}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">{hint}</p>
            </div>
          ))}
        </div>

        {/* ข้อกำหนด */}
        <Card className="mt-6">
          <CardHeader title="ข้อกำหนดและเงื่อนไขการใช้ห้อง" subtitle="ข้อความชุดเดียวกับที่แสดงบนหน้าจอง" />
          <ul className="space-y-2.5 text-sm leading-relaxed text-ink-600">
            {bookingTerms().map((t, i) => (
              <li key={i} className="flex gap-2">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                {t}
              </li>
            ))}
          </ul>
        </Card>

        {/* ตารางสิทธิ์ */}
        <Card className="mt-6">
          <CardHeader
            icon={<IconShield className="h-4.5 w-4.5" />}
            title="สิทธิ์ของแต่ละบทบาท"
            subtitle="ผู้ใช้ 1 คนมีได้หลายบทบาท"
          />
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
                  <th className="py-2 font-medium">การกระทำ</th>
                  {ROLE_COLS.map((r) => (
                    <th key={r} className="px-2 py-2 text-center font-medium">
                      {ROLE_LABEL[r].replace(/\s*\(.*\)/, "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {PERMISSIONS.map((row) => (
                  <tr key={row.action}>
                    <td className="py-2.5 pr-3 text-ink-700">{row.action}</td>
                    {row.cells.map((c, i) => (
                      <td key={i} className="px-2 py-2.5 text-center">
                        {c === true ? (
                          <IconCheck className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : c === false ? (
                          <IconX className="mx-auto h-4 w-4 text-ink-200" />
                        ) : (
                          <span className="text-[11px] text-amber-700">{c}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ความเป็นส่วนตัว */}
        <Card className="mt-6">
          <CardHeader
            icon={<IconLock className="h-4.5 w-4.5" />}
            title="ข้อมูลไหนเป็นสาธารณะ ข้อมูลไหนเป็นข้อมูลภายใน"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="mb-2 flex items-center gap-2 font-semibold text-emerald-900">
                <IconCheck className="h-4 w-4" /> คนทั่วไปเห็นได้
              </p>
              <ul className="space-y-1.5 text-sm text-emerald-900">
                <li>• ช่วงเวลาที่ห้องถูกจอง</li>
                <li>• ชื่อเรื่อง / ชื่อวิชา (เช่น STAT1, อบรม)</li>
                <li>• ประเภทการใช้งาน (เรียน / ประชุม / อบรม)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <p className="mb-2 flex items-center gap-2 font-semibold text-rose-900">
                <IconLock className="h-4 w-4" /> ข้อมูลภายใน
              </p>
              <ul className="space-y-1.5 text-sm text-rose-900">
                <li>• ชื่อ-นามสกุลผู้จอง</li>
                <li>• อีเมล และเบอร์โทรศัพท์</li>
                <li>• วัตถุประสงค์ หมายเหตุ และเอกสารแนบ</li>
                <li>• จำนวนผู้เข้าร่วม</li>
              </ul>
            </div>
          </div>
          <Notice tone="warn" title="ชื่อเรื่องจะแสดงต่อสาธารณะ">
            ตอนกรอกฟอร์ม ระบบให้กรอก “ชื่อเรื่อง” แยกจาก “วัตถุประสงค์” โดยเจตนา —
            กรุณาใช้ชื่อสั้น ๆ ที่เปิดเผยได้ · หากไม่กรอก ระบบจะแสดงเป็น “ไม่ระบุ”
            และจะไม่นำชื่อผู้จองหรือวัตถุประสงค์มาแสดงแทนเด็ดขาด
          </Notice>
          <p className="mt-3 text-sm text-ink-500">
            อ่านเพิ่มเติมที่ <Link href="/privacy" className="font-medium text-brand-700 hover:underline">นโยบายความเป็นส่วนตัว</Link>
          </p>
        </Card>

        {/* คำถามที่พบบ่อย */}
        <Card className="mt-6">
          <CardHeader title="คำถามที่พบบ่อย" />
          <ul className="divide-y divide-ink-100">
            {FAQ.map((f, i) => (
              <li key={f.q}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
                >
                  <span className="font-medium text-ink-900">{f.q}</span>
                  <IconChevronDown
                    className={cx("h-4 w-4 shrink-0 text-ink-400 transition", open === i && "rotate-180")}
                  />
                </button>
                {open === i && (
                  <p className="animate-rise pb-4 text-sm leading-relaxed text-ink-500">{f.a}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-6">
          <Notice tone="warn" title="ระบบนี้อยู่ในสถานะทดลอง">
            <span className="flex flex-wrap items-center gap-2">
              <IconWarn className="h-4 w-4" />
              ข้อมูลทั้งหมดเป็นข้อมูลจำลองบนฐานข้อมูลสำหรับทดสอบ และยังไม่ใช่การจองจริง
              <Badge className="bg-white text-amber-800 ring-amber-300">prototype</Badge>
            </span>
          </Notice>
        </div>
      </div>
    </PageShell>
  );
}
