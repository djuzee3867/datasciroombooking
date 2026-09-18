"use client";

/**
 * สมัครสมาชิก (plan001.md §5)
 *
 * ขั้นที่ 1 กรอกข้อมูล → ขั้นที่ 2 ยืนยันอีเมลด้วยรหัส OTP 6 หลัก
 *
 * ผู้ที่เข้าด้วย Google หรือ SSO ไม่ต้องผ่านหน้านี้ —
 * ชื่อ–นามสกุลได้จากผู้ให้บริการอยู่แล้ว เหลือแค่กรอกเบอร์ติดต่อกับหน่วยงาน
 * ที่หน้า /signup/complete
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { signUpAction } from "@/lib/db/auth-actions";
import { AuthShell } from "@/components/auth/AuthShell";
import { OtpForm } from "@/components/auth/OtpForm";
import { Button, Field, Input, Notice } from "@/components/ui/primitives";

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { auth, refresh } = useStore();
  const next = params.get("next") || "/";

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", department: "",
    password: "", confirm: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState<{ minutes?: number; devCode?: string } | null>(null);

  const filled = form.firstName && form.lastName && form.email && form.phone
    && form.department && form.password && form.confirm;

  const submit = async () => {
    if (form.password !== form.confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await signUpAction({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        department: form.department,
      });
      if (!res.ok) setError(res.message ?? "สมัครไม่สำเร็จ");
      else setOtp({ minutes: res.otpMinutes, devCode: res.devCode });
    } finally {
      setBusy(false);
    }
  };

  if (otp) {
    return (
      <AuthShell title="ยืนยันอีเมล" subtitle="เราส่งรหัสไปให้แล้ว กรอกเพื่อเปิดใช้งานบัญชี">
        <OtpForm
          email={form.email.trim().toLowerCase()}
          minutes={otp.minutes}
          devCode={otp.devCode}
          onVerified={async () => {
            await refresh();
            // สมัครด้วยฟอร์มนี้กรอกข้อมูลติดต่อครบแล้ว จึงพากลับไปหน้าที่ตั้งใจไว้ได้เลย
            router.push(next);
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="สมัครสมาชิก"
      subtitle="สำหรับบุคลากร นักศึกษา และบุคคลภายนอกที่ต้องการจองห้อง"
      footer={
        <>
          มีบัญชีอยู่แล้ว?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-brand-700 hover:underline"
          >
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {auth.googleEnabled && (
          <>
            <a
              href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:bg-brand-50"
            >
              ดำเนินการต่อด้วย Google
            </a>
            <div className="flex items-center gap-3 text-xs text-ink-400">
              <span className="h-px flex-1 bg-ink-100" /> หรือกรอกข้อมูลเอง
              <span className="h-px flex-1 bg-ink-100" />
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อ" required>
            <Input
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              autoComplete="given-name"
              placeholder="สมชาย"
            />
          </Field>
          <Field label="นามสกุล" required>
            <Input
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              autoComplete="family-name"
              placeholder="ใจดี"
            />
          </Field>
        </div>

        <Field
          label="อีเมล"
          required
          hint="ใช้อีเมลมหาวิทยาลัยจะได้สิทธิ์จองห้องเต็มรูปแบบ · อีเมลอื่นจะเป็นบุคคลภายนอก"
        >
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            autoComplete="email"
            placeholder="you@cmu.ac.th"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="เบอร์โทรติดต่อ" required>
            <Input
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              autoComplete="tel"
              placeholder="081-234-5678"
            />
          </Field>
          <Field label="หน่วยงาน / สังกัด" required>
            <Input
              value={form.department}
              onChange={(e) => set("department")(e.target.value)}
              autoComplete="organization"
              placeholder="ภาควิชาวิทยาการข้อมูล"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="รหัสผ่าน" required hint="อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password")(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="ยืนยันรหัสผ่าน" required>
            <Input
              type="password"
              value={form.confirm}
              onChange={(e) => set("confirm")(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && filled) void submit(); }}
              autoComplete="new-password"
            />
          </Field>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <Button className="w-full" disabled={!filled || busy} onClick={submit}>
          {busy ? "กำลังสมัคร…" : "สมัครและรับรหัสยืนยัน"}
        </Button>

        <p className="text-xs leading-relaxed text-ink-400">
          เราจะส่งรหัสยืนยัน 6 หลักไปที่อีเมลของคุณเพื่อยืนยันตัวตนก่อนเปิดใช้งานบัญชี ·
          ข้อมูลที่กรอกใช้สำหรับติดต่อเรื่องการจองเท่านั้น ตาม
          <Link href="/privacy" className="ml-1 text-brand-700 hover:underline">
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
