"use client";

/**
 * กรอกข้อมูลติดต่อให้ครบหลังเข้าด้วย Google หรือ SSO (plan001.md §5)
 *
 * ผู้ให้บริการบอกชื่อ–นามสกุลและอีเมลมาแล้ว จึงเติมให้ล่วงหน้า
 * เหลือเบอร์ติดต่อกับหน่วยงานที่ระบบต้องใช้ตอนจองห้อง (§8.3)
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { completeProfileAction } from "@/lib/db/auth-actions";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, ButtonLink, Field, Input, Notice } from "@/components/ui/primitives";

export function CompleteProfileForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { viewer, auth, refresh } = useStore();
  const next = params.get("next") || "/";

  const [firstName, setFirstName] = useState(() => viewer?.name.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(
    () => viewer?.name.split(" ").slice(1).join(" ") ?? "",
  );
  const [phone, setPhone] = useState(() => viewer?.phone ?? "");
  const [department, setDepartment] = useState(() => viewer?.department ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.user) {
    return (
      <AuthShell title="ยังไม่ได้เข้าสู่ระบบ" subtitle="กรุณาเข้าสู่ระบบก่อนกรอกข้อมูล">
        <ButtonLink href="/login" className="w-full">ไปหน้าเข้าสู่ระบบ</ButtonLink>
      </AuthShell>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await completeProfileAction({ firstName, lastName, phone, department });
      if (!res.ok) setError(res.message ?? "บันทึกไม่สำเร็จ");
      else {
        await refresh();
        router.push(next);
      }
    } finally {
      setBusy(false);
    }
  };

  const filled = firstName && lastName && phone && department;

  return (
    <AuthShell
      title="อีกนิดเดียว"
      subtitle={`ยินดีต้อนรับ ${auth.user.name} — ขอข้อมูลติดต่อเพิ่มเพื่อใช้ตอนจองห้อง`}
    >
      <div className="space-y-4">
        <Notice tone="info">
          บัญชี <strong>{auth.user.email}</strong> ยืนยันตัวตนแล้ว
          เหลือเบอร์ติดต่อกับหน่วยงานที่ผู้ดูแลห้องต้องใช้ตอนประสานงาน
        </Notice>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อ" required>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="นามสกุล" required>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>

        <Field label="เบอร์โทรติดต่อ" required>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="081-234-5678"
          />
        </Field>

        <Field label="หน่วยงาน / สังกัด" required>
          <Input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && filled) void submit(); }}
            autoComplete="organization"
            placeholder="ภาควิชาวิทยาการข้อมูล"
          />
        </Field>

        {error && <Notice tone="error">{error}</Notice>}

        <Button className="w-full" disabled={!filled || busy} onClick={submit}>
          {busy ? "กำลังบันทึก…" : "บันทึกและเริ่มใช้งาน"}
        </Button>
      </div>
    </AuthShell>
  );
}
