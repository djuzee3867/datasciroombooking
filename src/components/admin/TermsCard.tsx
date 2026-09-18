"use client";

/**
 * ภาคการศึกษา — เพิ่ม แก้ไข และลบช่วงวันที่ (plan001.md §3.1, §10)
 *
 * ใช้เป็นตัวเลือกตั้งต้นของ "ตารางประจำเทอม" — เลือกเทอมแล้วช่วงวันที่จะถูกเติมให้
 * ฐานข้อมูลมี EXCLUDE constraint กันช่วงวันที่ทับกันอยู่แล้ว หน้าจอจึงแค่แสดงข้อความที่ได้กลับมา
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { thaiDateMedium } from "@/lib/time";
import type { Term } from "@/lib/types";
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, Notice,
} from "@/components/ui/primitives";
import { IconCalendarPlus } from "@/components/ui/icons";

interface Draft {
  name: string;
  startDate: string;
  endDate: string;
}

const EMPTY: Draft = { name: "", startDate: "", endDate: "" };

export function TermsCard() {
  const { db, today, actions, pending } = useStore();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
      return false;
    }
  };

  const create = async () => {
    if (await run(() => actions.createTerm(draft), "เพิ่มภาคการศึกษาไม่สำเร็จ")) {
      setDraft(EMPTY);
      setAdding(false);
    }
  };

  const save = async (termId: string) => {
    if (await run(() => actions.updateTerm(termId, edit), "บันทึกไม่สำเร็จ")) {
      setEditId(null);
    }
  };

  const remove = async (termId: string) => {
    if (await run(() => actions.deleteTerm(termId), "ลบไม่สำเร็จ")) {
      setConfirmId(null);
    }
  };

  const startEdit = (t: Term) => {
    setEditId(t.id);
    setEdit({ name: t.name, startDate: t.startDate, endDate: t.endDate });
    setConfirmId(null);
    setError(null);
  };

  const valid = (d: Draft) => Boolean(d.name.trim() && d.startDate && d.endDate);

  return (
    <Card>
      <CardHeader
        icon={<IconCalendarPlus className="h-4.5 w-4.5" />}
        title="ภาคการศึกษา"
        subtitle="ใช้กำหนดช่วงของการจองประจำทั้งเทอม · ช่วงวันที่ห้ามคาบเกี่ยวกัน"
        action={
          !adding && (
            <Button
              variant="secondary"
              onClick={() => { setAdding(true); setDraft(EMPTY); setError(null); }}
            >
              + เพิ่มช่วง
            </Button>
          )
        }
      />

      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}

      {adding && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <p className="mb-3 text-sm font-medium text-brand-900">เพิ่มภาคการศึกษาใหม่</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="ชื่อภาคการศึกษา" required>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="เช่น ภาคปลาย 2568"
              />
            </Field>
            <Field label="วันเริ่ม" required>
              <Input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </Field>
            <Field label="วันสิ้นสุด" required>
              <Input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setAdding(false); setError(null); }}>
              ยกเลิก
            </Button>
            <Button disabled={!valid(draft) || pending} onClick={create}>
              {pending ? "กำลังบันทึก…" : "เพิ่มภาคการศึกษา"}
            </Button>
          </div>
        </div>
      )}

      {db.terms.length === 0 ? (
        <EmptyState
          title="ยังไม่มีภาคการศึกษา"
          description="เพิ่มช่วงวันที่ของเทอมไว้ แล้วตารางประจำเทอมจะเลือกช่วงนี้ได้ทันที"
        />
      ) : (
        <ul className="divide-y divide-ink-100">
          {db.terms.map((t) => {
            const current = t.startDate <= today && today <= t.endDate;
            if (editId === t.id) {
              return (
                <li key={t.id} className="py-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="ชื่อภาคการศึกษา" required>
                      <Input
                        value={edit.name}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      />
                    </Field>
                    <Field label="วันเริ่ม" required>
                      <Input
                        type="date"
                        value={edit.startDate}
                        onChange={(e) => setEdit({ ...edit, startDate: e.target.value })}
                      />
                    </Field>
                    <Field label="วันสิ้นสุด" required>
                      <Input
                        type="date"
                        value={edit.endDate}
                        onChange={(e) => setEdit({ ...edit, endDate: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>ยกเลิก</Button>
                    <Button size="sm" disabled={!valid(edit) || pending} onClick={() => save(t.id)}>
                      บันทึก
                    </Button>
                  </div>
                </li>
              );
            }
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                    {t.name}
                    {current && (
                      <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200" dot="bg-emerald-500">
                        เทอมปัจจุบัน
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-ink-400">
                    {thaiDateMedium(t.startDate)} – {thaiDateMedium(t.endDate)}
                  </p>
                </div>
                {confirmId === t.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-700">ลบภาคการศึกษานี้?</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>ไม่ลบ</Button>
                    <Button variant="danger" size="sm" disabled={pending} onClick={() => remove(t.id)}>
                      ยืนยันลบ
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>แก้ไข</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => { setConfirmId(t.id); setError(null); }}
                    >
                      ลบ
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Notice tone="info">
        ภาคการศึกษาไม่ได้บล็อกการจอง — ใช้เป็นช่วงตั้งต้นให้ตารางประจำเทอมเท่านั้น ·
        ลบไม่ได้ถ้ายังมีตารางประจำเทอมอ้างถึงอยู่
      </Notice>
    </Card>
  );
}
