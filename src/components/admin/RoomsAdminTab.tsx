"use client";

/**
 * จัดการห้อง และการเพิ่มอาคาร/ห้องใหม่ (plan001.md §10)
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { listFloors, listUnits } from "@/lib/repo";
import {
  Badge, Button, Card, CardHeader, Notice, cx,
} from "@/components/ui/primitives";
import { IconBuilding } from "@/components/ui/icons";
import { UnitDetailsModal } from "./UnitDetailsModal";
import { CreateBuildingModal } from "./CreateBuildingModal";
import { CreateUnitModal } from "./CreateUnitModal";

export function RoomsAdminTab() {
  const { db, actions, pending } = useStore();
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [addBuilding, setAddBuilding] = useState(false);
  const [addUnit, setAddUnit] = useState(false);

  const units = listUnits(db);

  return (
    <div className="space-y-5">

      {/* ---------------- อาคาร ---------------- */}
      <Card>
        <CardHeader
          icon={<IconBuilding className="h-4.5 w-4.5" />}
          title="อาคารและชั้น"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setAddBuilding(true)}>+ เพิ่มอาคาร</Button>
              <Button onClick={() => setAddUnit(true)}>+ เพิ่มห้อง</Button>
            </div>
          }
        />
        <ul className="grid gap-3 sm:grid-cols-2">
          {db.buildings.map((b) => {
            const floors = listFloors(db, b.id);
            const rooms = units.filter((u) => floors.some((f) => f.id === u.floorId));
            return (
              <li key={b.id} className="rounded-xl border border-ink-100 p-4">
                <p className="font-semibold text-ink-900">{b.code}</p>
                <p className="text-xs text-ink-400">{b.name}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {floors.map((f) => (
                    <Badge key={f.id} className="bg-ink-50 text-ink-600 ring-ink-200">
                      ชั้น {f.floorNo} · {rooms.filter((u) => u.floorId === f.id).length} ห้อง
                    </Badge>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ---------------- ห้อง ---------------- */}
      <Card>
        <CardHeader
          title="ห้องทั้งหมด"
          subtitle="แก้ข้อมูลห้อง และเปิด/ปิดการจอง"
        />
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
                <th className="py-2 font-medium">ห้อง</th>
                <th className="py-2 font-medium">ชั้น</th>
                <th className="py-2 font-medium">ประเภท</th>
                <th className="py-2 font-medium">ความจุ</th>
                <th className="py-2 font-medium">พื้นที่ที่กิน</th>
                <th className="py-2 font-medium">สถานะ</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {units.map((u) => {
                const floor = db.floors.find((f) => f.id === u.floorId);
                const spaces = db.unitSpaces
                  .filter((us) => us.unitId === u.id)
                  .map((us) => db.spaces.find((s) => s.id === us.spaceId)?.code)
                  .filter(Boolean);
                return (
                  <tr key={u.id}>
                    <td className="py-3">
                      <p className="font-medium text-ink-900">{u.code}</p>
                      <p className="text-xs text-ink-400">{u.name}</p>
                    </td>
                    <td className="py-3 text-ink-600">ชั้น {floor?.floorNo}</td>
                    <td className="py-3 text-ink-600">{u.roomType}</td>
                    <td className="py-3 tabular-nums text-ink-600">{u.capacity || "-"}</td>
                    <td className="py-3 text-xs text-ink-500">{spaces.join(", ")}</td>
                    <td className="py-3">
                      {u.isBookable ? (
                        <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200" dot="bg-emerald-500">
                          เปิดจอง
                        </Badge>
                      ) : (
                        <Badge className="bg-ink-100 text-ink-500 ring-ink-200" dot="bg-ink-400">ปิด</Badge>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditUnitId(u.id)}>แก้ไข</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          className={cx(
                            u.isBookable
                              ? "text-rose-600 hover:bg-rose-50"
                              : "text-emerald-700 hover:bg-emerald-50",
                          )}
                          onClick={() =>
                            actions.updateUnitDetails(u.id, {
                              isBookable: !u.isBookable,
                              unbookableReason: u.isBookable ? "ปิดใช้งานชั่วคราวโดยแอดมิน" : null,
                            })
                          }
                        >
                          {u.isBookable ? "ปิดห้อง" : "เปิดห้อง"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Notice tone="info" title="เรื่องห้องรวม">
          ห้องที่รวมกัน (เช่น SCB4305-6) กินพื้นที่ของห้องย่อยทั้งหมด
          ระบบตรวจการชนที่ระดับพื้นที่เสมอ จองห้องรวมแล้วห้องย่อยจะไม่ว่างโดยอัตโนมัติ
        </Notice>
      </Card>

      <UnitDetailsModal unitId={editUnitId} onClose={() => setEditUnitId(null)} />
      <CreateBuildingModal open={addBuilding} onClose={() => setAddBuilding(false)} />
      <CreateUnitModal open={addUnit} onClose={() => setAddUnit(false)} />
    </div>
  );
}
