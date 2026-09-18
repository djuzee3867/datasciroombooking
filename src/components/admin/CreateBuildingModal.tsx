"use client";

/** เพิ่มอาคารใหม่พร้อมชั้น — เฉพาะแอดมิน (plan001.md §10) */

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  Button, Field, Input, Modal, Notice,
} from "@/components/ui/primitives";
import { IconX } from "@/components/ui/icons";

export function CreateBuildingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { actions, pending } = useStore();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [floors, setFloors] = useState([
    { floorNo: 1, name: "" },
    { floorNo: 2, name: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    try {
      await actions.createBuilding({ code, name, floors });
      setCode(""); setName("");
      setFloors([{ floorNo: 1, name: "" }, { floorNo: 2, name: "" }]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มอาคารไม่สำเร็จ");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มอาคารใหม่"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending || !code.trim() || !name.trim()}>
            {pending ? "กำลังบันทึก…" : "เพิ่มอาคาร"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="รหัสอาคาร" required hint="ใช้เป็นตัวย่อในระบบ เช่น SCB5">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SCB5"
            />
          </Field>
          <Field label="ชื่ออาคาร" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="อาคารเรียนรวม 5"
            />
          </Field>
        </div>

        <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-700">ชั้นในอาคาร</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setFloors((f) => [...f, { floorNo: (f.at(-1)?.floorNo ?? 0) + 1, name: "" }])
              }
            >
              + เพิ่มชั้น
            </Button>
          </div>
          <ul className="space-y-2">
            {floors.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={f.floorNo}
                  aria-label={`เลขชั้นที่ ${i + 1}`}
                  className="w-24"
                  onChange={(e) =>
                    setFloors((list) =>
                      list.map((r, j) => (j === i ? { ...r, floorNo: Number(e.target.value) } : r)))
                  }
                />
                <Input
                  value={f.name}
                  placeholder={`ชื่อชั้น เช่น ห้องบรรยาย (ไม่ใส่ก็ได้)`}
                  aria-label={`ชื่อชั้นที่ ${i + 1}`}
                  onChange={(e) =>
                    setFloors((list) =>
                      list.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-rose-600 hover:bg-rose-50"
                  aria-label="ลบชั้นนี้"
                  disabled={floors.length === 1}
                  onClick={() => setFloors((list) => list.filter((_, j) => j !== i))}
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <Notice tone="info">
          เพิ่มอาคารแล้วยังไม่มีห้อง — ใช้ปุ่ม “เพิ่มห้อง” เพื่อสร้างห้องในแต่ละชั้นต่อไป
          แผนผังชั้นของอาคารใหม่จะยังว่างจนกว่าจะมีแปลนจริง
        </Notice>

        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Modal>
  );
}
