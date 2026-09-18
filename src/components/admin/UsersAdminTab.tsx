"use client";

/**
 * สิทธิ์ผู้ใช้ (plan001.md §4.2, §10)
 *
 * หมายเหตุการตัดสินใจ: แผนกำหนดให้เฉพาะ SUPER_ADMIN กำหนด role ได้
 * แต่ตามที่ผู้ใช้ระบุ ให้ ADMIN แต่งตั้งแอดมินคนใหม่ได้ด้วย
 * จึงเปิดให้ ADMIN จัดการได้ถึงระดับ ADMIN · ส่วน SUPER_ADMIN ยังสงวนไว้ให้ SUPER_ADMIN
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/policy";
import { hasRole } from "@/lib/repo";
import type { Role } from "@/lib/types";
import { Badge, Card, CardHeader, Input, Notice, cx } from "@/components/ui/primitives";
import { IconCheck, IconShield, IconX } from "@/components/ui/icons";

const MANAGED_ROLES: Role[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export function UsersAdminTab() {
  const { db, viewer, actions, pending } = useStore();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isSuper = hasRole(viewer, "SUPER_ADMIN");

  const q = query.trim().toLowerCase();
  const users = db.users.filter(
    (u) =>
      !q
      || u.name.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || u.department.toLowerCase().includes(q),
  );

  const toggle = async (userId: string, role: Role, grant: boolean) => {
    setError(null);
    try {
      await actions.setUserRole(userId, role, grant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เปลี่ยนสิทธิ์ไม่สำเร็จ");
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<IconShield className="h-4.5 w-4.5" />}
        title="สิทธิ์ผู้ใช้"
        subtitle="กดที่ช่องเพื่อให้หรือถอดสิทธิ์ · ล็อกอิน SSO ครั้งแรกจะได้ USER อัตโนมัติ"
        action={
          <div className="w-full sm:w-64">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ อีเมล หรือหน่วยงาน"
            />
          </div>
        }
      />

      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}

      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
              <th className="py-2 font-medium">ผู้ใช้</th>
              <th className="py-2 font-medium">หน่วยงาน</th>
              {MANAGED_ROLES.map((r) => (
                <th key={r} className="px-2 py-2 text-center font-medium">
                  {ROLE_LABEL[r].replace(/\s*\(.*\)/, "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-3">
                  <p className="font-medium text-ink-900">
                    {u.name}
                    {u.id === viewer?.id && (
                      <Badge className="ml-2 bg-brand-50 text-brand-700 ring-brand-200">คุณ</Badge>
                    )}
                  </p>
                  <p className="text-xs text-ink-400">{u.email}</p>
                </td>
                <td className="py-3 text-ink-600">{u.department}</td>
                {MANAGED_ROLES.map((role) => {
                  const on = u.roles.includes(role);
                  const superLocked = role === "SUPER_ADMIN" && !isSuper;
                  const selfLock =
                    on && u.id === viewer?.id && (role === "ADMIN" || role === "SUPER_ADMIN");
                  const disabled = pending || superLocked || selfLock;
                  return (
                    <td key={role} className="px-2 py-3 text-center">
                      <button
                        onClick={() => toggle(u.id, role, !on)}
                        disabled={disabled}
                        aria-pressed={on}
                        aria-label={`${on ? "ถอด" : "ให้"}สิทธิ์ ${ROLE_LABEL[role]} กับ ${u.name}`}
                        title={
                          superLocked ? "เฉพาะผู้ดูแลระบบเท่านั้นที่กำหนดสิทธิ์นี้ได้"
                            : selfLock ? "ถอดสิทธิ์ของตัวเองไม่ได้"
                              : on ? "กดเพื่อถอดสิทธิ์" : "กดเพื่อให้สิทธิ์"
                        }
                        className={cx(
                          "mx-auto grid h-8 w-8 place-items-center rounded-lg border transition",
                          on
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-ink-200 text-ink-300 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {on ? <IconCheck className="h-4 w-4" /> : <IconX className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Notice tone="info" title="กติกาที่ระบบบังคับไว้">
        <ul className="mt-1 space-y-0.5">
          <li>• ถอดสิทธิ์แอดมินของตัวเองไม่ได้ — ต้องให้แอดมินคนอื่นเป็นผู้ดำเนินการ</li>
          <li>• ต้องเหลือแอดมินอย่างน้อย 1 คนในระบบเสมอ</li>
          <li>• สิทธิ์ผู้ดูแลระบบ (SUPER_ADMIN) กำหนดได้เฉพาะผู้ดูแลระบบเท่านั้น</li>
        </ul>
      </Notice>
    </Card>
  );
}
