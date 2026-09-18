"use client";

/**
 * แก้ไขรายละเอียดห้อง — สำหรับแอดมิน
 * แก้ได้ทั้งชื่อ ประเภท ความจุ เวลาให้บริการ การเปิด/ปิดห้อง คำอธิบาย และอุปกรณ์
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { POLICY } from "@/lib/policy";
import { hasRole } from "@/lib/repo";
import type { UnitPatch } from "@/lib/db/admin-actions";
import type { BookableUnit } from "@/lib/types";
import { timeOptions } from "@/lib/time";
import {
  Button, Field, Input, Modal, Notice, Select, Textarea, cx,
} from "@/components/ui/primitives";
import { EquipmentIcon } from "@/components/ui/icons";

export function UnitDetailsModal({
  unitId,
  onClose,
}: {
  unitId: string | null;
  onClose: () => void;
}) {
  const { db } = useStore();
  const unit = unitId ? db.bookableUnits.find((u) => u.id === unitId) : null;
  if (!unit) return null;
  // key ทำให้ฟอร์มถูกสร้างใหม่เมื่อเปลี่ยนห้อง จึงตั้งค่าเริ่มต้นได้จาก props ตรง ๆ
  // ไม่ต้องใช้ effect คอยซิงก์ state
  return <UnitDetailsForm key={unit.id} unit={unit} onClose={onClose} />;
}

function UnitDetailsForm({
  unit,
  onClose,
}: {
  unit: BookableUnit;
  onClose: () => void;
}) {
  const { db, viewer, actions, pending } = useStore();
  const canEditAll = hasRole(viewer, "ADMIN", "SUPER_ADMIN");

  const [description, setDescription] = useState(unit.description);
  const [contactNote, setContactNote] = useState(unit.contactNote);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(unit.equipmentIds);
  const [name, setName] = useState(unit.name);
  const [roomType, setRoomType] = useState(unit.roomType);
  const [capacity, setCapacity] = useState<number | "">(unit.capacity);
  const [isBookable, setIsBookable] = useState(unit.isBookable);
  const [openToGuest, setOpenToGuest] = useState(unit.openToGuest);
  const [useCustomHours, setUseCustomHours] = useState(Boolean(unit.bookingHoursOverride));
  const [openTime, setOpenTime] = useState(unit.bookingHoursOverride?.open ?? POLICY.openTime);
  const [closeTime, setCloseTime] = useState(unit.bookingHoursOverride?.close ?? POLICY.closeTime);
  const [unbookableReason, setUnbookableReason] = useState(unit.unbookableReason ?? "");
  const [error, setError] = useState<string | null>(null);

  const times = timeOptions("06:00", "22:00", POLICY.slotMinutes);

  const save = async () => {
    setError(null);
    const patch: UnitPatch = { description, contactNote, equipmentIds };
    if (canEditAll) {
      patch.name = name;
      patch.roomType = roomType;
      patch.capacity = Number(capacity) || 0;
      patch.isBookable = isBookable;
      patch.openToGuest = openToGuest;
      patch.openTime = useCustomHours ? openTime : null;
      patch.closeTime = useCustomHours ? closeTime : null;
      patch.unbookableReason = isBookable ? null : unbookableReason;
    }
    try {
      await actions.updateUnitDetails(unit.id, patch);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`แก้ไขข้อมูลห้อง ${unit.code}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {canEditAll && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อห้อง" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="ประเภทห้อง">
              <Input
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                placeholder="เช่น ห้องบรรยาย"
              />
            </Field>
            <Field label="ความจุ (คน)">
              <Input
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </Field>
            <Field label="บุคคลภายนอก">
              <Select
                value={openToGuest ? "1" : "0"}
                onChange={(e) => setOpenToGuest(e.target.value === "1")}
              >
                <option value="0">จองไม่ได้</option>
                <option value="1">จองได้</option>
              </Select>
            </Field>
          </div>
        )}

        <Field label="คำอธิบายห้อง" hint="แสดงบนหน้ารายละเอียดห้อง">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24"
          />
        </Field>

        <Field label="ข้อความถึงผู้จอง" hint="เช่น จุดรับกุญแจ หรือสิ่งที่ต้องแจ้งล่วงหน้า">
          <Textarea
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
            className="min-h-20"
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">อุปกรณ์ประจำห้อง</p>
          <div className="flex flex-wrap gap-2">
            {db.equipment.map((eq) => {
              const on = equipmentIds.includes(eq.id);
              return (
                <button
                  key={eq.id}
                  onClick={() =>
                    setEquipmentIds((list) =>
                      on ? list.filter((x) => x !== eq.id) : [...list, eq.id])
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

        {canEditAll && (
          <>
            <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={useCustomHours}
                  onChange={(e) => setUseCustomHours(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                กำหนดเวลาให้บริการเฉพาะห้องนี้
                <span className="text-ink-400">
                  (ค่ากลางคือ {POLICY.openTime}–{POLICY.closeTime} น.)
                </span>
              </label>
              {useCustomHours && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="เปิด">
                    <Select value={openTime} onChange={(e) => setOpenTime(e.target.value)}>
                      {times.slice(0, -1).map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="ปิด">
                    <Select value={closeTime} onChange={(e) => setCloseTime(e.target.value)}>
                      {times.filter((t) => t > openTime).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={!isBookable}
                  onChange={(e) => setIsBookable(!e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                ปิดห้องนี้ ไม่ให้จองผ่านระบบ
              </label>
              {!isBookable && (
                <div className="mt-3">
                  <Field label="เหตุผลที่จองไม่ได้" required hint="แสดงให้ผู้ใช้เห็นบนหน้าห้อง">
                    <Input
                      value={unbookableReason}
                      onChange={(e) => setUnbookableReason(e.target.value)}
                      placeholder="เช่น ปิดปรับปรุงถึงสิ้นภาคการศึกษา"
                    />
                  </Field>
                </div>
              )}
            </div>
          </>
        )}

        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Modal>
  );
}
