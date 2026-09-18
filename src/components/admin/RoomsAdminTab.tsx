"use client";

/**
 * จัดการห้อง ผู้ดูแลห้อง และการเพิ่มอาคาร/ห้องใหม่ (plan001.md §10)
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { listFloors, listUnits, managersOf } from "@/lib/repo";
import {
  Badge, Button, Card, CardHeader, EmptyState, Input, Notice, cx,
} from "@/components/ui/primitives";
import { IconBuilding, IconCalendarPlus, IconUsers, IconX } from "@/components/ui/icons";
import { UnitDetailsModal } from "./UnitDetailsModal";
import { CreateBuildingModal } from "./CreateBuildingModal";
import { CreateUnitModal } from "./CreateUnitModal";

export function RoomsAdminTab() {
  const { db, actions, pending } = useStore();
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [addBuilding, setAddBuilding] = useState(false);
  const [addUnit, setAddUnit] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const units = listUnits(db);

  /**
   * แต่งตั้งด้วยอีเมล ไม่ใช่เลือกจากรายชื่อ — คนที่จะมาดูแลห้องส่วนใหญ่
   * ยังไม่เคยล็อกอิน จึงยังไม่มีชื่อให้เลือก (ระบบสร้างบัญชีรอไว้ให้)
   */
  const assign = async (unitId: string) => {
    const email = assignEmail.trim();
    if (!email) return;
    setError(null);
    setNotice(null);
    try {
      const res = await actions.assignRoomManager(email, unitId);
      setAssignFor(null);
      setAssignEmail("");
      setNotice(
        res.invited
          ? `ยังไม่มีบัญชี ${res.email} ในระบบ — สร้างบัญชีรอไว้ให้แล้ว `
            + "ผู้ใช้จะได้สิทธิ์ผู้ดูแลห้องทันทีที่ล็อกอินครั้งแรกด้วยอีเมลนี้"
          : `แต่งตั้ง ${res.name} (${res.email}) เป็นผู้ดูแลห้องเรียบร้อย`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "แต่งตั้งไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-5">
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

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
          subtitle="แก้ข้อมูลห้อง เปิด/ปิดการจอง และแต่งตั้งผู้ดูแลห้อง"
        />
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
                <th className="py-2 font-medium">ห้อง</th>
                <th className="py-2 font-medium">ชั้น</th>
                <th className="py-2 font-medium">ประเภท</th>
                <th className="py-2 font-medium">ความจุ</th>
                <th className="py-2 font-medium">พื้นที่ที่กิน</th>
                <th className="py-2 font-medium">ผู้ดูแล</th>
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
                const mgrs = managersOf(db, u.id);
                const candidates = db.users.filter(
                  (x) => !mgrs.some((m) => m.id === x.id) && !x.roles.includes("GUEST"),
                );
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
                      {mgrs.length === 0 ? (
                        <span className="text-xs text-ink-400">ยังไม่แต่งตั้ง</span>
                      ) : (
                        <ul className="space-y-1">
                          {mgrs.map((m) => (
                            <li key={m.id} className="flex items-center gap-1">
                              <span className="text-xs text-ink-700">{m.name}</span>
                              <button
                                onClick={() => actions.removeRoomManager(m.id, u.id)}
                                disabled={pending}
                                aria-label={`ถอด ${m.name} ออกจากผู้ดูแลห้อง ${u.code}`}
                                className="rounded p-0.5 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <IconX className="h-3 w-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {assignFor === u.id ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <Input
                            type="email"
                            value={assignEmail}
                            onChange={(e) => setAssignEmail(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void assign(u.id); }}
                            list={`known-emails-${u.id}`}
                            placeholder="อีเมลผู้ดูแล"
                            aria-label={`อีเมลผู้ดูแลห้อง ${u.code}`}
                            className="h-8 w-52 text-xs"
                          />
                          {/* รายชื่อที่มีอยู่แล้วเป็นแค่ตัวช่วยเติม — พิมพ์อีเมลอื่นได้เสมอ */}
                          <datalist id={`known-emails-${u.id}`}>
                            {candidates.map((c) => (
                              <option key={c.id} value={c.email}>{c.name}</option>
                            ))}
                          </datalist>
                          <Button
                            size="sm"
                            disabled={!assignEmail.trim() || pending}
                            onClick={() => assign(u.id)}
                          >
                            เพิ่ม
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setAssignFor(null)}>
                            ยกเลิก
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAssignFor(u.id); setAssignEmail(""); }}
                          className="mt-1 flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                        >
                          <IconUsers className="h-3 w-3" /> แต่งตั้งผู้ดูแล
                        </button>
                      )}
                    </td>
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

      {/* ---------------- ผู้ดูแลห้อง ---------------- */}
      <Card>
        <CardHeader
          title="ผู้ดูแลห้องทั้งหมด"
          subtitle="แต่งตั้งด้วยอีเมลจากตารางด้านบน · ผู้ดูแลห้องไม่มีสิทธิ์อนุมัติคำขอ (§4.2)"
        />
        {db.users.filter((u) => u.roles.includes("ROOM_MANAGER")).length === 0 ? (
          <EmptyState title="ยังไม่มีผู้ดูแลห้อง" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {db.users
              .filter((u) => u.roles.includes("ROOM_MANAGER"))
              .map((m) => {
                const owned = db.roomManagers
                  .filter((r) => r.userId === m.id)
                  .map((r) => db.bookableUnits.find((u) => u.id === r.unitId))
                  .filter(Boolean);
                return (
                  <li key={m.id} className="rounded-xl border border-ink-100 p-4">
                    <p className="font-medium text-ink-900">{m.name}</p>
                    <p className="text-xs text-ink-400">{m.department} · {m.email}</p>
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {owned.map((u) => (
                        <Badge key={u!.id} className="bg-brand-50 text-brand-700 ring-brand-200">
                          {u!.code}
                        </Badge>
                      ))}
                    </p>
                  </li>
                );
              })}
          </ul>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-400">
          <IconCalendarPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          แต่งตั้งด้วยอีเมล — กรอกอีเมลที่ยังไม่เคยเข้าระบบได้ ระบบจะสร้างบัญชีรอไว้ให้
          และผู้ใช้จะได้สิทธิ์ ROOM_MANAGER ทันทีที่ล็อกอินครั้งแรก ·
          ถอดออกจากทุกห้องแล้วสิทธิ์จะถูกยกเลิกให้เอง
        </p>
      </Card>

      <UnitDetailsModal unitId={editUnitId} onClose={() => setEditUnitId(null)} />
      <CreateBuildingModal open={addBuilding} onClose={() => setAddBuilding(false)} />
      <CreateUnitModal open={addUnit} onClose={() => setAddUnit(false)} />
    </div>
  );
}
