"use client";

/**
 * เพิ่มห้องใหม่ — เฉพาะแอดมิน (plan001.md §10)
 *
 * จุดสำคัญคือการเลือก "พื้นที่" ที่ห้องนี้กิน (§6.1)
 *   ห้องเดี่ยว → สร้างพื้นที่ใหม่ตามรหัสห้องโดยอัตโนมัติ
 *   ห้องรวม   → เลือกพื้นที่เดิมหลายอัน เช่น SCB4305-6 กิน SCB4305 + SCB4306
 * ระบบจะกันการชนที่ระดับพื้นที่ให้เองทันทีที่ผูกเสร็จ
 */

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { POLICY } from "@/lib/policy";
import { listFloors } from "@/lib/repo";
import { timeOptions } from "@/lib/time";
import {
  Button, Field, Input, Modal, Notice, Select, Textarea, cx,
} from "@/components/ui/primitives";
import { EquipmentIcon } from "@/components/ui/icons";

export function CreateUnitModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { db, actions, pending } = useStore();
  const buildings = db.buildings;

  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const floors = useMemo(() => listFloors(db, buildingId), [db, buildingId]);
  const [floorId, setFloorId] = useState(floors[0]?.id ?? "");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [capacity, setCapacity] = useState<number | "">("");
  const [isBookable, setIsBookable] = useState(true);
  const [openToGuest, setOpenToGuest] = useState(false);
  const [useCustomHours, setUseCustomHours] = useState(false);
  const [openTime, setOpenTime] = useState(POLICY.openTime);
  const [closeTime, setCloseTime] = useState(POLICY.closeTime);
  const [description, setDescription] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [unbookableReason, setUnbookableReason] = useState("");
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [spaceMode, setSpaceMode] = useState<"new" | "existing">("new");
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const effectiveFloorId = floors.some((f) => f.id === floorId) ? floorId : (floors[0]?.id ?? "");
  const floorSpaces = db.spaces.filter((s) => s.floorId === effectiveFloorId);
  const times = timeOptions("06:00", "22:00", POLICY.slotMinutes);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    try {
      await actions.createUnit({
        floorId: effectiveFloorId,
        code, name, roomType,
        capacity: Number(capacity) || 0,
        isBookable, openToGuest,
        openTime: useCustomHours ? openTime : null,
        closeTime: useCustomHours ? closeTime : null,
        description, contactNote, unbookableReason,
        equipmentIds, spaceMode, spaceIds,
      });
      setCode(""); setName(""); setRoomType(""); setCapacity("");
      setDescription(""); setContactNote(""); setUnbookableReason("");
      setEquipmentIds([]); setSpaceIds([]); setSpaceMode("new");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มห้องไม่สำเร็จ");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="เพิ่มห้องใหม่"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending || !code.trim() || !name.trim() || !effectiveFloorId}>
            {pending ? "กำลังบันทึก…" : "เพิ่มห้อง"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="อาคาร" required>
            <Select
              value={buildingId}
              onChange={(e) => { setBuildingId(e.target.value); setSpaceIds([]); }}
            >
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
            </Select>
          </Field>
          <Field label="ชั้น" required>
            <Select
              value={effectiveFloorId}
              onChange={(e) => { setFloorId(e.target.value); setSpaceIds([]); }}
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>ชั้น {f.floorNo} · {f.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="รหัสห้อง" required hint="ใช้อ้างอิงทั้งระบบ เช่น SCB4306">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SCB4306"
            />
          </Field>
          <Field label="ชื่อห้อง" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ห้องปฏิบัติการ 4306"
            />
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
        </div>

        {/* ---- พื้นที่ที่ห้องนี้กิน (§6.1) ---- */}
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          <p className="mb-2 text-sm font-medium text-brand-900">พื้นที่ที่ห้องนี้กิน</p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-700">
              <input
                type="radio"
                name="spaceMode"
                checked={spaceMode === "new"}
                onChange={() => setSpaceMode("new")}
                className="mt-0.5 h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="font-medium">ห้องเดี่ยว</span> — สร้างพื้นที่ใหม่ตามรหัสห้องให้อัตโนมัติ
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-700">
              <input
                type="radio"
                name="spaceMode"
                checked={spaceMode === "existing"}
                onChange={() => setSpaceMode("existing")}
                className="mt-0.5 h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="font-medium">ห้องรวม</span> — เลือกพื้นที่เดิมที่ห้องนี้กินทั้งหมด
                <span className="block text-xs text-ink-500">
                  เช่น SCB4305-6 กินพื้นที่ SCB4305 และ SCB4306 · จองห้องรวมแล้วห้องย่อยจะเต็มทันที
                </span>
              </span>
            </label>
          </div>

          {spaceMode === "existing" && (
            <div className="mt-3">
              {floorSpaces.length === 0 ? (
                <p className="text-xs text-ink-500">ชั้นนี้ยังไม่มีพื้นที่ให้เลือก</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {floorSpaces.map((sp) => {
                    const on = spaceIds.includes(sp.id);
                    return (
                      <button
                        key={sp.id}
                        onClick={() =>
                          setSpaceIds((l) => (on ? l.filter((x) => x !== sp.id) : [...l, sp.id]))
                        }
                        aria-pressed={on}
                        className={cx(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          on
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-ink-200 bg-white text-ink-600 hover:border-brand-300",
                        )}
                      >
                        {sp.code}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <Field label="คำอธิบายห้อง">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-20"
            placeholder="อธิบายลักษณะห้องและการใช้งานที่เหมาะสม"
          />
        </Field>

        <Field label="ข้อความถึงผู้จอง" hint="เช่น จุดรับกุญแจ หรือสิ่งที่ต้องแจ้งล่วงหน้า">
          <Input value={contactNote} onChange={(e) => setContactNote(e.target.value)} />
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
                    setEquipmentIds((l) => (on ? l.filter((x) => x !== eq.id) : [...l, eq.id]))
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

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-100 p-3 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={openToGuest}
              onChange={(e) => setOpenToGuest(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            เปิดให้บุคคลภายนอกจองได้
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink-100 p-3 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={useCustomHours}
              onChange={(e) => setUseCustomHours(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            กำหนดเวลาให้บริการเฉพาะห้องนี้
          </label>
        </div>

        {useCustomHours && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="เปิด">
              <Select value={openTime} onChange={(e) => setOpenTime(e.target.value)}>
                {times.slice(0, -1).map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="ปิด">
              <Select value={closeTime} onChange={(e) => setCloseTime(e.target.value)}>
                {times.filter((t) => t > openTime).map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={!isBookable}
              onChange={(e) => setIsBookable(!e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            ห้องนี้ไม่เปิดให้จองผ่านระบบ (เช่น ห้องวิจัย หรือพื้นที่ส่วนกลาง)
          </label>
          {!isBookable && (
            <div className="mt-3">
              <Field label="เหตุผลที่จองไม่ได้" required hint="แสดงให้ผู้ใช้เห็นบนหน้าห้อง">
                <Input
                  value={unbookableReason}
                  onChange={(e) => setUnbookableReason(e.target.value)}
                  placeholder="เช่น ห้องวิจัยประจำศูนย์ ไม่เปิดให้จองทั่วไป"
                />
              </Field>
            </div>
          )}
        </div>

        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Modal>
  );
}
