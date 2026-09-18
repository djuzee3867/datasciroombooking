"use client";

/**
 * กรอกรหัส OTP 6 หลักที่ส่งไปทางอีเมล (plan001.md §5)
 * ใช้ทั้งตอนสมัครใหม่ และตอนเข้าสู่ระบบด้วยบัญชีที่ยังไม่ได้ยืนยันอีเมล
 */

import { useState } from "react";
import { resendOtpAction, verifyEmailAction } from "@/lib/db/auth-actions";
import { Button, Field, Input, Notice } from "@/components/ui/primitives";

export function OtpForm({
  email,
  minutes,
  devCode,
  onVerified,
}: {
  email: string;
  minutes?: number;
  devCode?: string;
  /** needsProfile = ยังต้องกรอกเบอร์ติดต่อ/หน่วยงานต่อ */
  onVerified: (needsProfile: boolean) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hint, setHint] = useState(devCode);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await verifyEmailAction(email, code);
      if (!res.ok) setError(res.message ?? "ยืนยันไม่สำเร็จ");
      else onVerified(Boolean(res.needsProfile));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await resendOtpAction(email);
    setBusy(false);
    if (!res.ok) setError(res.message ?? "ส่งรหัสใหม่ไม่สำเร็จ");
    else {
      setNotice(res.message ?? "ส่งรหัสใหม่ให้แล้ว");
      setHint(res.devCode);
    }
  };

  return (
    <div className="space-y-4">
      <Notice tone="info">
        ส่งรหัสยืนยัน 6 หลักไปที่ <strong>{email}</strong> แล้ว
        {minutes ? ` · ใช้ได้ภายใน ${minutes} นาที` : ""}
      </Notice>

      {hint && (
        <Notice tone="warn" title="โหมดพัฒนา — ยังไม่ได้ต่อเซิร์ฟเวอร์อีเมล">
          รหัสสำหรับทดสอบคือ <strong className="font-mono tracking-widest">{hint}</strong>
          {" "}· เมื่อฝ่ายไอทีให้ค่า SMTP มาแล้ว รหัสจะถูกส่งเข้าอีเมลจริงและข้อความนี้จะหายไปเอง
        </Notice>
      )}

      <Field label="รหัสยืนยัน 6 หลัก" required>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) void submit(); }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          className="text-center font-mono text-lg tracking-[0.4em]"
        />
      </Field>

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <Button className="w-full" disabled={code.length !== 6 || busy} onClick={submit}>
        {busy ? "กำลังตรวจสอบ…" : "ยืนยันตัวตน"}
      </Button>

      <button
        onClick={resend}
        disabled={busy}
        className="w-full text-center text-sm text-ink-500 hover:text-brand-700 disabled:opacity-50"
      >
        ไม่ได้รับรหัส? ส่งใหม่อีกครั้ง
      </button>
    </div>
  );
}
