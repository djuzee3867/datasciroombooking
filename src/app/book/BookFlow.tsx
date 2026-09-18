"use client";

/**
 * หน้าจองห้อง 3 ขั้นตอน (plan001.md §8.3)
 *   ขั้น 1 เลือกตึก → ขั้น 2 เลือกห้อง → ขั้น 3 กรอกรายละเอียด
 *
 * ทุกกฎการตรวจใช้ validateDraft() จาก lib/conflicts เท่านั้น
 * ห้ามเขียนกฎซ้ำในหน้านี้ (§12 ข้อ 3)
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore, type UploadedAttachment } from "@/lib/store";
import { CATEGORY_META, POLICY, bookingTerms } from "@/lib/policy";
import {
  bookingHoursOf, firstBookableDate, validateDraft, type BookingDraft,
} from "@/lib/conflicts";
import { getUnitByCode, listFloors, listUnits, scheduleForDay } from "@/lib/repo";
import type { BookableUnit, BookingCategory } from "@/lib/types";
import {
  hhmmToMinutes, minutesToHhmm, thaiDateLong, thaiDateMedium, timeOptions,
} from "@/lib/time";
import { PageShell, PageHeading } from "@/components/layout/SiteShell";
import {
  Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Field, Input,
  Modal, Notice, Select, Textarea, cx,
} from "@/components/ui/primitives";
import {
  EquipmentIcon, IconBuilding, IconCalendarPlus, IconCheck, IconChevronLeft,
  IconClock, IconDoc, IconLayers, IconUsers, IconWarn,
} from "@/components/ui/icons";
import { RoomPhoto } from "@/components/RoomPhoto";
import { fileSizeLabel } from "@/components/AttachmentPreview";
import { AvailabilityCalendar } from "@/components/DatePickers";
import { TimelineBar, CategoryLegend } from "@/components/schedule/TimelineBar";

/** ช่วงเวลาที่ให้เลือกได้บนฟอร์ม — กว้างกว่าเวลาให้บริการ เพราะจองนอกเวลาได้ (ต้องแนบเอกสาร) */
const PICKER_OPEN = "06:00";
const PICKER_CLOSE = "22:00";

const CATEGORIES: BookingCategory[] = ["CLASS", "MEETING", "TRAINING", "ACTIVITY", "EXAM"];

type Step = 1 | 2 | 3;

export function BookFlow() {
  const { db, today, viewer, actions, pending } = useStore();
  const params = useSearchParams();

  const buildings = db.buildings;

  // เข้ามาจากลิงก์ ?unit=SCB4303 → เริ่มที่ขั้นที่ 3 พร้อมห้องที่เลือกไว้แล้ว
  const preset = (() => {
    const code = params.get("unit");
    const u = code ? getUnitByCode(db, code) : null;
    if (!u?.isBookable) return null;
    return {
      unitId: u.id,
      buildingId: db.floors.find((f) => f.id === u.floorId)?.buildingId ?? db.buildings[0]?.id ?? null,
    };
  })();

  const [step, setStep] = useState<Step>(preset ? 3 : 1);
  const [buildingId, setBuildingId] = useState<string | null>(preset?.buildingId ?? null);
  const [unitId, setUnitId] = useState<string | null>(preset?.unitId ?? null);
  const [dateKey, setDateKey] = useState<string>(firstBookableDate(today));

  // ตัวกรองขั้นเลือกห้อง
  const [floorId, setFloorId] = useState("all");
  const [minCapacity, setMinCapacity] = useState("");
  const [needEquipment, setNeedEquipment] = useState<string[]>([]);

  // ฟอร์มขั้นที่ 3
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [publicTitle, setPublicTitle] = useState("");
  const [category, setCategory] = useState<BookingCategory>("MEETING");
  const [attendeeCount, setAttendeeCount] = useState<number | "">("");
  const [purpose, setPurpose] = useState("");
  const [contactPhone, setContactPhone] = useState(viewer?.phone ?? "");
  // ไฟล์ถูกอัปโหลดทันทีที่เลือก แล้วเก็บ id ไว้ผูกกับการจองตอนกดยืนยัน
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const attachmentName = attachment?.fileName ?? null;
  const [note, setNote] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const unit = unitId ? db.bookableUnits.find((u) => u.id === unitId) ?? null : null;
  const hours = bookingHoursOf(unit ?? undefined);

  const draft: BookingDraft = {
    unitId: unitId ?? "",
    dateKey,
    startTime,
    endTime,
    publicTitle,
    attendeeCount,
    purpose,
    contactPhone,
    attachmentName,
    note,
    category,
    acceptedTerms,
  };

  const result = validateDraft(db, draft, { today });

  const err = (k: string) => (touched ? result.errors[k] : undefined);
  const entries = unit ? scheduleForDay(db, unit.id, dateKey) : [];

  // ขยายกรอบเวลาของแถบตาราง ให้เห็นแท่งร่างแม้เลือกนอกเวลาให้บริการ
  const displayHours = (() => {
    let open = hhmmToMinutes(hours.open);
    let close = hhmmToMinutes(hours.close);
    if (startTime) open = Math.min(open, hhmmToMinutes(startTime));
    if (endTime) close = Math.max(close, hhmmToMinutes(endTime));
    return {
      open: minutesToHhmm(Math.floor(open / 60) * 60),
      close: minutesToHhmm(Math.ceil(close / 60) * 60),
    };
  })();

  /** อัปโหลดทันทีที่เลือกไฟล์ เพื่อให้รู้ผลก่อนกดยืนยัน (ขนาด/ชนิดไฟล์ผิดจะเห็นทันที) */
  async function pickAttachment(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      setAttachment(await actions.uploadAttachment(file));
    } catch (err) {
      setAttachment(null);
      setUploadError(err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!unit || !viewer) return;
    const res = await actions.createBooking({
      unitId: unit.id,
      startAt: result.startAt,
      endAt: result.endAt,
      publicTitle: publicTitle.trim(),
      category,
      purpose: purpose.trim(),
      attendeeCount: Number(attendeeCount),
      contactPhone: contactPhone.trim(),
      attachmentName,
      attachmentId: attachment?.id ?? null,
      note: note.trim(),
      outsideHours: result.outsideHours,
    });
    setConfirming(false);
    if (!res.ok) {
      setSubmitError(res.message);
      return;
    }
    setDoneId(res.bookingId);
  }

  /* ---------------- ขั้นตอนบนหัวหน้า ---------------- */
  const steps = [
    { n: 1 as Step, label: "เลือกตึก" },
    { n: 2 as Step, label: "เลือกห้อง" },
    { n: 3 as Step, label: "กรอกรายละเอียด" },
  ];

  /**
   * ย้ายขั้นตอน — รับค่าที่เพิ่งเลือกเข้ามาด้วย (ready) เพราะตอนกดปุ่มในจังหวะเดียวกัน
   * state ยังเป็นค่าเดิมของรอบ render นี้ ถ้าเช็คจาก state ตรง ๆ จะกดครั้งแรกไม่ติด
   */
  const goStep = (n: Step, ready?: { building?: string | null; unit?: string | null }) => {
    if (n === 2 && !(ready?.building ?? buildingId)) return;
    if (n === 3 && !(ready?.unit ?? unitId)) return;
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------------- หน้าจอสำเร็จ ---------------- */
  if (doneId) {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Card className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <IconCheck className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-ink-900">ส่งคำขอจองเรียบร้อยแล้ว</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              คำขอของคุณอยู่ในสถานะ <strong className="text-amber-700">รออนุมัติ</strong> และ
              <strong> กันเวลาไว้ให้แล้ว</strong> เพื่อไม่ให้ผู้อื่นจองซ้อนระหว่างรอ
              <br />
              แอดมินจะพิจารณาภายใน {POLICY.pendingExpiryHours} ชั่วโมง
              เมื่ออนุมัติแล้วถือว่าการจองสมบูรณ์
            </p>

            <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl border border-ink-100 bg-ink-50/60 p-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">ห้อง</dt>
                <dd className="text-right font-medium text-ink-900">{unit?.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">วันที่</dt>
                <dd className="text-right font-medium text-ink-900">{thaiDateLong(dateKey)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">เวลา</dt>
                <dd className="text-right font-medium text-ink-900">{startTime}–{endTime} น.</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">ชื่อเรื่อง (สาธารณะ)</dt>
                <dd className="text-right font-medium text-ink-900">{publicTitle}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/my-bookings">ดูการจองของฉัน</ButtonLink>
              <ButtonLink href={`/rooms/${unit?.code}`} variant="secondary">ดูตารางห้อง</ButtonLink>
              <Button
                variant="ghost"
                onClick={() => {
                  setDoneId(null);
                  setStep(1);
                  setUnitId(null);
                  setStartTime(""); setEndTime(""); setPublicTitle(""); setPurpose("");
                  setAttendeeCount(""); setNote(""); setAttachment(null); setUploadError(null);
                  setAcceptedTerms(false); setTouched(false);
                }}
              >
                จองห้องอื่นต่อ
              </Button>
            </div>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeading
        eyebrow={`ขั้นตอนที่ ${step} จาก 3`}
        title={steps[step - 1].label}
        description={
          step === 1
            ? "เลือกอาคารที่ต้องการใช้ห้อง — ขณะนี้เปิดให้บริการเฉพาะอาคาร SCB4"
            : step === 2
              ? `เลือกวันที่และห้องที่ต้องการ · วันแรกที่จองได้คือ ${thaiDateMedium(firstBookableDate(today))} ตามกฎจองล่วงหน้า ${POLICY.leadTimeDays} วัน`
              : "กรอกรายละเอียดการใช้งานให้ครบถ้วน ก่อนยืนยันคำขอจอง"
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* แถบขั้นตอน */}
        <ol className="mb-8 flex flex-wrap items-center gap-2">
          {steps.map((s, i) => {
            const active = s.n === step;
            const done = s.n < step;
            const reachable = s.n === 1 || (s.n === 2 && buildingId) || (s.n === 3 && unitId);
            return (
              <li key={s.n} className="flex items-center gap-2">
                <button
                  onClick={() => reachable && goStep(s.n)}
                  disabled={!reachable}
                  className={cx(
                    "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
                    active
                      ? "border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                      : done
                        ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
                        : "border-ink-200 bg-white text-ink-400",
                    !reachable && "cursor-not-allowed",
                  )}
                >
                  <span
                    className={cx(
                      "grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold",
                      active ? "bg-white/25" : done ? "bg-brand-600 text-white" : "bg-ink-100",
                    )}
                  >
                    {done ? <IconCheck className="h-3 w-3" /> : s.n}
                  </span>
                  {s.label}
                </button>
                {i < steps.length - 1 && <span className="h-px w-4 bg-ink-200 sm:w-8" aria-hidden />}
              </li>
            );
          })}
        </ol>

        {!viewer && (
          <div className="mb-6">
            <Notice tone="warn" title="ยังไม่ได้เข้าสู่ระบบ">
              คุณดูข้อมูลห้องและตารางได้ตามปกติ แต่ต้องเข้าสู่ระบบก่อนจึงจะส่งคำขอจองได้
              — กดปุ่มบัญชีมุมขวาบนเพื่อเลือกผู้ใช้ทดลอง
            </Notice>
          </div>
        )}

        {/* ---------------- ขั้นที่ 1 ---------------- */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buildings.map((b) => {
              const floors = listFloors(db, b.id);
              const rooms = listUnits(db, { bookableOnly: true }).filter((u) =>
                floors.some((f) => f.id === u.floorId),
              );
              return (
                <button
                  key={b.id}
                  onClick={() => { setBuildingId(b.id); goStep(2, { building: b.id }); }}
                  className="group overflow-hidden rounded-2xl border border-ink-100 bg-white text-left transition hover:border-brand-300 hover:shadow-lg hover:shadow-brand-600/5"
                >
                  <RoomPhoto seed="a" code={b.code} className="aspect-[16/7] w-full" label={`ภาพจำลองอาคาร ${b.code}`} />
                  <div className="p-5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                        <IconBuilding className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="font-semibold text-ink-900">{b.code}</p>
                        <p className="text-xs text-ink-400">{b.name.replace(/^อาคาร\s*\S+\s*—\s*/, "")}</p>
                      </div>
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-500">
                      <li className="flex items-center gap-1.5"><IconLayers className="h-4 w-4 text-ink-400" />{floors.length} ชั้น</li>
                      <li className="flex items-center gap-1.5"><IconCalendarPlus className="h-4 w-4 text-ink-400" />{rooms.length} ห้องที่จองได้</li>
                    </ul>
                    <p className="mt-4 text-sm font-medium text-brand-700">เลือกอาคารนี้ →</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ---------------- ขั้นที่ 2 ---------------- */}
        {step === 2 && buildingId && (
          <Step2
            db={db}
            buildingId={buildingId}
            floorId={floorId}
            setFloorId={setFloorId}
            minCapacity={minCapacity}
            setMinCapacity={setMinCapacity}
            needEquipment={needEquipment}
            setNeedEquipment={setNeedEquipment}
            dateKey={dateKey}
            setDateKey={setDateKey}
            onPick={(u) => { setUnitId(u.id); goStep(3, { unit: u.id }); }}
            onBack={() => goStep(1)}
          />
        )}

        {/* ---------------- ขั้นที่ 3 ---------------- */}
        {step === 3 && unit && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <Card>
                <CardHeader
                  icon={<IconClock className="h-4.5 w-4.5" />}
                  title="ข้อมูลห้องและเวลา"
                  action={
                    <Button variant="ghost" size="sm" onClick={() => goStep(2)}>
                      <IconChevronLeft className="h-3.5 w-3.5" /> เปลี่ยนห้อง
                    </Button>
                  }
                />

                <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <RoomPhoto seed={unit.images[0] ?? "a"} code={unit.code} className="h-16 w-24 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">{unit.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span className="flex items-center gap-1"><IconUsers className="h-3.5 w-3.5" />รองรับ {unit.capacity} คน</span>
                      <span className="flex items-center gap-1"><IconClock className="h-3.5 w-3.5" />{hours.open}–{hours.close} น.</span>
                      <span>{unit.roomType}</span>
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="วันที่ต้องการใช้งาน" required error={err("dateKey")} className="sm:col-span-2">
                    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3">
                      <p className="text-sm font-medium text-ink-900">{thaiDateLong(dateKey)}</p>
                      <button
                        onClick={() => goStep(2)}
                        className="mt-1 text-xs font-medium text-brand-700 hover:underline"
                      >
                        เปลี่ยนวันที่
                      </button>
                    </div>
                  </Field>

                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-medium text-ink-700">
                      ตารางเวลาของห้องในวันที่เลือก
                    </p>
                    <TimelineBar
                      entries={entries}
                      hours={displayHours}
                      ghost={
                        startTime && endTime
                          ? {
                            startTime,
                            endTime,
                            invalid: result.conflicts.length > 0,
                            label: `${startTime}–${endTime} · ${publicTitle || "รายการของคุณ"}`,
                          }
                          : null
                      }
                      emptyLabel="ยังไม่มีรายการจองในวันนี้ — เลือกเวลาแล้วจะแสดงช่วงของคุณด้วยกรอบเส้นประ"
                    />
                    <div className="mt-3">
                      <CategoryLegend compact />
                    </div>
                  </div>

                  <Field label="ตั้งแต่เวลา" required error={err("startTime")}>
                    <Select
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        if (endTime && hhmmToMinutes(endTime) <= hhmmToMinutes(e.target.value)) setEndTime("");
                      }}
                    >
                      <option value="">กรุณาเลือกเวลา</option>
                      {timeOptions(PICKER_OPEN, PICKER_CLOSE, POLICY.slotMinutes).slice(0, -1).map((t) => (
                        <option key={t} value={t}>
                          {t}{outsideLabel(t, hours)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="ถึงเวลา" required error={err("endTime")}>
                    <Select value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!startTime}>
                      <option value="">กรุณาเลือกเวลา</option>
                      {timeOptions(PICKER_OPEN, PICKER_CLOSE, POLICY.slotMinutes)
                        .filter((t) => !startTime || hhmmToMinutes(t) > hhmmToMinutes(startTime))
                        .map((t) => (
                          <option key={t} value={t}>
                            {t}{outsideLabel(t, hours)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                </div>

                {result.warnings.map((w) => (
                  <div key={w} className="mt-4">
                    <Notice tone="warn" title="ใช้ห้องนอกเวลาให้บริการ">{w}</Notice>
                  </div>
                ))}

                {result.conflicts.length > 0 && (
                  <div className="mt-4">
                    <Notice tone="error" title="ช่วงเวลานี้ถูกจองไปแล้ว">
                      <ul className="mt-1 space-y-1">
                        {result.conflicts.map((c, i) => (
                          <li key={i}>
                            • {c.spaceCode} · {c.startAt.slice(11, 16)}–{c.endAt.slice(11, 16)} น. ·{" "}
                            {c.kind === "BLACKOUT" ? `ปิดใช้งาน: ${c.label}` : c.label}
                          </li>
                        ))}
                      </ul>
                      {unit.code.includes("-") && (
                        <p className="mt-2 text-xs">
                          ห้องนี้เป็นห้องรวม การจองห้องย่อยของมันจะทำให้ห้องรวมไม่ว่างไปด้วย
                        </p>
                      )}
                    </Notice>
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader icon={<IconDoc className="h-4.5 w-4.5" />} title="รายละเอียดการใช้งาน" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="ชื่อเรื่อง / ชื่อวิชา"
                    required
                    error={err("publicTitle")}
                    hint="ข้อความนี้จะแสดงต่อสาธารณะบนตารางห้อง เช่น STAT1 · ประชุมภาควิชา · อบรม"
                  >
                    <Input
                      value={publicTitle}
                      onChange={(e) => setPublicTitle(e.target.value)}
                      placeholder="เช่น STAT1"
                      maxLength={40}
                    />
                  </Field>

                  <Field label="ประเภทการใช้งาน" required>
                    <Select value={category} onChange={(e) => setCategory(e.target.value as BookingCategory)}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="จำนวนผู้เข้าร่วม"
                    required
                    error={err("attendeeCount")}
                    hint={`ห้องนี้รองรับได้ ${unit.capacity} คน`}
                  >
                    <Input
                      type="number"
                      min={1}
                      max={unit.capacity}
                      value={attendeeCount}
                      onChange={(e) => setAttendeeCount(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="กรุณากรอกจำนวนผู้เข้าร่วม"
                    />
                  </Field>

                  <Field
                    label="หมายเลขโทรศัพท์ติดต่อ"
                    required
                    error={err("contactPhone")}
                    hint="ข้อมูลภายใน ใช้ติดต่อกรณีมีปัญหา ไม่แสดงต่อสาธารณะ"
                  >
                    <Input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="0XX-XXX-XXXX"
                      inputMode="tel"
                    />
                  </Field>

                  <Field
                    label="วัตถุประสงค์การใช้งาน"
                    required
                    error={err("purpose")}
                    hint="ข้อมูลภายใน เห็นได้เฉพาะผู้จอง และแอดมิน"
                    className="sm:col-span-2"
                  >
                    <Textarea
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="อธิบายการใช้งานโดยย่อ เช่น ประชุมคณะกรรมการประจำภาควิชา ครั้งที่ 9"
                    />
                  </Field>

                  <Field
                    label="เอกสารเพิ่มเติม"
                    error={err("attachmentName")}
                    hint={`รองรับ ${POLICY.attachment.acceptedTypes.join(" / ")} ขนาดไม่เกิน ${POLICY.attachment.maxSizeMb} MB · จำเป็นเมื่อใช้ห้องนอกเวลาให้บริการ`}
                    className="sm:col-span-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={cx(
                          "flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-200 px-4 text-sm text-ink-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700",
                          uploading && "pointer-events-none opacity-60",
                        )}
                      >
                        <IconDoc className="h-4 w-4" />
                        {uploading ? "กำลังอัปโหลด…" : attachment ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}
                        <input
                          type="file"
                          className="sr-only"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            e.target.value = "";
                            void pickAttachment(file);
                          }}
                        />
                      </label>
                      {attachment && (
                        <Badge className="bg-brand-50 text-brand-700 ring-brand-200">
                          {attachment.fileName} · {fileSizeLabel(attachment.byteSize)}
                          <button
                            onClick={() => { setAttachment(null); setUploadError(null); }}
                            className="ml-1 text-brand-500 hover:text-brand-800"
                            aria-label="ลบไฟล์แนบ"
                          >
                            ✕
                          </button>
                        </Badge>
                      )}
                    </div>
                    {uploadError && (
                      <p className="mt-1.5 text-xs text-rose-600">{uploadError}</p>
                    )}
                    <p className="mt-1.5 text-xs text-ink-400">
                      ไฟล์ถูกอัปโหลดเก็บไว้จริง — ผู้อนุมัติเปิดดูและดาวน์โหลดได้จากหน้ารายละเอียดคำขอ
                    </p>
                  </Field>

                  <Field label="หมายเหตุถึงผู้อนุมัติ" className="sm:col-span-2">
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="เช่น ขอจัดโต๊ะแบบตัว U · ขอยืมไมค์เพิ่ม 2 ตัว"
                      className="min-h-20"
                    />
                  </Field>
                </div>
              </Card>
            </div>

            {/* ---------- แถบสรุปด้านขวา ---------- */}
            <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardHeader title="ข้อกำหนดและเงื่อนไข" />
                <ul className="space-y-2.5 text-sm leading-relaxed text-ink-600">
                  {bookingTerms().map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-ink-700">
                    ข้าพเจ้าได้อ่านและยอมรับข้อกำหนดและเงื่อนไขการใช้ห้องทั้งหมด
                  </span>
                </label>
                {err("acceptedTerms") && (
                  <p className="mt-2 text-xs font-medium text-rose-600">{err("acceptedTerms")}</p>
                )}
              </Card>

              <Card>
                <CardHeader title="สรุปคำขอ" />
                <dl className="space-y-2.5 text-sm">
                  {[
                    ["ห้อง", unit.name],
                    ["วันที่", thaiDateLong(dateKey)],
                    ["เวลา", startTime && endTime ? `${startTime}–${endTime} น.` : "ยังไม่เลือก"],
                    ["ชื่อเรื่อง", publicTitle || "ยังไม่กรอก"],
                    ["ผู้เข้าร่วม", attendeeCount ? `${attendeeCount} คน` : "ยังไม่กรอก"],
                    ["ผู้จอง", viewer?.name ?? "ยังไม่เข้าสู่ระบบ"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-4">
                      <dt className="shrink-0 text-ink-400">{k}</dt>
                      <dd className="text-right font-medium text-ink-900">{v}</dd>
                    </div>
                  ))}
                </dl>

                {touched && Object.keys(result.errors).length > 0 && (
                  <div className="mt-4">
                    <Notice tone="error" title="ยังกรอกไม่ครบ">
                      <ul className="mt-1 space-y-0.5">
                        {Object.values(result.errors).slice(0, 4).map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </Notice>
                  </div>
                )}
                {submitError && (
                  <div className="mt-4"><Notice tone="error">{submitError}</Notice></div>
                )}

                <Button
                  size="lg"
                  className="mt-4 w-full"
                  disabled={!viewer}
                  onClick={() => {
                    setTouched(true);
                    setSubmitError(null);
                    if (Object.keys(result.errors).length === 0) setConfirming(true);
                  }}
                >
                  ตรวจสอบและยืนยันคำขอ
                </Button>
                <p className="mt-2 text-center text-xs text-ink-400">
                  ระบบจะแสดงหน้าสรุปให้ตรวจอีกครั้งก่อนส่งจริง
                </p>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ---------- หน้าสรุปยืนยัน ---------- */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="ยืนยันคำขอจองห้อง"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>กลับไปแก้ไข</Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "กำลังส่ง…" : "ยืนยันส่งคำขอ"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Notice tone="info">
            เมื่อส่งคำขอแล้ว ระบบจะกันเวลานี้ไว้ทันทีเพื่อไม่ให้ผู้อื่นจองซ้อน
            และรอแอดมินพิจารณา หากถูกปฏิเสธ เวลาจะถูกปล่อยคืนอัตโนมัติ
          </Notice>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["ห้อง", `${unit?.name} (${unit?.code})`],
              ["ประเภท", CATEGORY_META[category].label],
              ["วันที่", thaiDateLong(dateKey)],
              ["เวลา", `${startTime}–${endTime} น.`],
              ["ชื่อเรื่อง (แสดงต่อสาธารณะ)", publicTitle],
              ["จำนวนผู้เข้าร่วม", `${attendeeCount} คน`],
              ["ผู้รับผิดชอบ", viewer?.name ?? "-"],
              ["เบอร์ติดต่อ", contactPhone],
              ["วัตถุประสงค์", purpose],
              ["เอกสารแนบ", attachmentName ?? "ไม่มี"],
              ["หมายเหตุ", note || "ไม่มี"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-ink-100 p-3">
                <dt className="text-xs text-ink-400">{k}</dt>
                <dd className="mt-0.5 text-sm font-medium text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
          {result.outsideHours && (
            <Notice tone="warn" title="เป็นการใช้ห้องนอกเวลาให้บริการ">
              คำขอนี้จะถูกพิจารณาเป็นกรณีพิเศษพร้อมเอกสารที่แนบมา
            </Notice>
          )}
        </div>
      </Modal>
    </PageShell>
  );
}

function outsideLabel(t: string, hours: { open: string; close: string }) {
  const m = hhmmToMinutes(t);
  if (m < hhmmToMinutes(hours.open) || m > hhmmToMinutes(hours.close)) return " · นอกเวลา";
  return "";
}

/* ---------------- ขั้นที่ 2: เลือกห้อง ---------------- */

function Step2({
  db, buildingId, floorId, setFloorId, minCapacity, setMinCapacity,
  needEquipment, setNeedEquipment, dateKey, setDateKey, onPick, onBack,
}: {
  db: ReturnType<typeof useStore>["db"];
  buildingId: string;
  floorId: string;
  setFloorId: (v: string) => void;
  minCapacity: string;
  setMinCapacity: (v: string) => void;
  needEquipment: string[];
  setNeedEquipment: (v: string[]) => void;
  dateKey: string;
  setDateKey: (v: string) => void;
  onPick: (u: BookableUnit) => void;
  onBack: () => void;
}) {
  const floors = listFloors(db, buildingId);
  const [previewUnit, setPreviewUnit] = useState<string | null>(null);

  const rooms = listUnits(db, {
    floorId: floorId === "all" ? undefined : floorId,
    bookableOnly: true,
  })
    .filter((u) => floors.some((f) => f.id === u.floorId))
    .filter((u) => !minCapacity || u.capacity >= Number(minCapacity))
    .filter((u) => needEquipment.every((e) => u.equipmentIds.includes(e)));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader title="เลือกวันที่" subtitle="สีบนปฏิทินบอกว่าวันนั้นห้องว่างมากหรือน้อย" />
          <AvailabilityCalendar
            unitId={previewUnit ?? rooms[0]?.id}
            value={dateKey}
            onChange={setDateKey}
            months={2}
          />
        </Card>

        <Card>
          <CardHeader title="ตัวกรองห้อง" />
          <div className="space-y-4">
            <Field label="ชั้น">
              <Select value={floorId} onChange={(e) => setFloorId(e.target.value)}>
                <option value="all">ทุกชั้น</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>ชั้น {f.floorNo} · {f.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="ความจุขั้นต่ำ (คน)">
              <Input
                type="number"
                min={1}
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
                placeholder="ไม่ระบุ"
              />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-700">อุปกรณ์ที่ต้องการ</p>
              <div className="flex flex-wrap gap-2">
                {db.equipment.map((eq) => {
                  const on = needEquipment.includes(eq.id);
                  return (
                    <button
                      key={eq.id}
                      onClick={() =>
                        setNeedEquipment(
                          on ? needEquipment.filter((x) => x !== eq.id) : [...needEquipment, eq.id],
                        )
                      }
                      aria-pressed={on}
                      className={cx(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        on
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-ink-200 text-ink-600 hover:border-brand-300 hover:bg-brand-50",
                      )}
                    >
                      <EquipmentIcon icon={eq.icon} className="h-3.5 w-3.5" />
                      {eq.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {(minCapacity || needEquipment.length > 0 || floorId !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setMinCapacity(""); setNeedEquipment([]); setFloorId("all"); }}
              >
                ล้างตัวกรองทั้งหมด
              </Button>
            )}
          </div>
        </Card>

        <Button variant="secondary" className="w-full" onClick={onBack}>
          <IconChevronLeft className="h-4 w-4" /> ย้อนกลับไปเลือกตึก
        </Button>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <span>
            <strong>พบ {rooms.length} ห้อง</strong> ที่ตรงเงื่อนไข · {thaiDateLong(dateKey)}
          </span>
          <Badge className="bg-white text-brand-700 ring-brand-200">
            <IconClock className="h-3.5 w-3.5" />
            เวลาให้บริการ {POLICY.openTime}–{POLICY.closeTime} น.
          </Badge>
        </div>

        {rooms.length === 0 ? (
          <EmptyState
            title="ไม่มีห้องที่ตรงกับเงื่อนไข"
            description="ลองลดความจุขั้นต่ำ หรือเอาอุปกรณ์บางรายการออก"
          />
        ) : (
          <div className="space-y-3">
            {rooms.map((u) => (
              <RoomPickRow
                key={u.id}
                db={db}
                unit={u}
                dateKey={dateKey}
                onHover={() => setPreviewUnit(u.id)}
                onPick={() => onPick(u)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** แถวเลือกห้อง — ออกแบบใหม่ให้อ่านง่ายกว่าการ์ดเดิม: เห็นช่วงว่างของวันทันที */
function RoomPickRow({
  db, unit, dateKey, onPick, onHover,
}: {
  db: ReturnType<typeof useStore>["db"];
  unit: BookableUnit;
  dateKey: string;
  onPick: () => void;
  onHover: () => void;
}) {
  const hours = bookingHoursOf(unit);
  const entries = scheduleForDay(db, unit.id, dateKey);
  const freeMinutes =
    hhmmToMinutes(hours.close) - hhmmToMinutes(hours.open)
    - entries.reduce((s, e) => s + (new Date(e.endAt).getTime() - new Date(e.startAt).getTime()) / 60000, 0);

  return (
    <article
      onMouseEnter={onHover}
      className="rounded-2xl border border-ink-100 bg-white p-4 transition hover:border-brand-300 sm:p-5"
    >
      <div className="flex flex-wrap items-start gap-4">
        <RoomPhoto seed={unit.images[0] ?? "a"} code={unit.code} className="h-20 w-28 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-ink-900">{unit.name}</h3>
              <p className="mt-0.5 text-xs text-ink-400">{unit.code} · {unit.roomType}</p>
            </div>
            <Badge
              className={
                freeMinutes > 240
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : freeMinutes > 60
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-rose-50 text-rose-700 ring-rose-200"
              }
              dot={freeMinutes > 240 ? "bg-emerald-500" : freeMinutes > 60 ? "bg-amber-500" : "bg-rose-500"}
            >
              ว่างประมาณ {Math.max(0, Math.round(freeMinutes / 30) / 2)} ชม.
            </Badge>
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-500">
            <li className="flex items-center gap-1.5"><IconUsers className="h-4 w-4 text-ink-400" />{unit.capacity} ที่นั่ง</li>
            <li className="flex items-center gap-1.5"><IconClock className="h-4 w-4 text-ink-400" />{hours.open}–{hours.close} น.</li>
            {unit.openToGuest && <li className="text-brand-600">เปิดให้บุคคลภายนอกจองได้</li>}
          </ul>
        </div>
        <div className="flex shrink-0 gap-2">
          <ButtonLink href={`/rooms/${unit.code}`} variant="secondary" size="sm">รายละเอียด</ButtonLink>
          <Button size="sm" onClick={onPick}>เลือกห้องนี้</Button>
        </div>
      </div>

      <div className="mt-3 border-t border-ink-100 pt-3">
        <TimelineBar entries={entries} hours={hours} height="h-9" emptyLabel="ว่างทั้งวัน" />
      </div>

      {unit.code.includes("-") && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-400">
          <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ห้องรวม — การจองจะกันเวลาของห้องย่อยทั้งสองห้องพร้อมกัน
        </p>
      )}
    </article>
  );
}
