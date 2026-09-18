"use client";

/**
 * เข้าสู่ระบบ (plan001.md §5)
 *
 * 3 ทาง: อีเมล+รหัสผ่าน · Google · SSO มหาวิทยาลัย (ยังรอจากฝ่ายไอที)
 * บัญชีที่ยังไม่ได้ยืนยันอีเมลจะถูกพาไปกรอก OTP ต่อทันที
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { loginAction } from "@/lib/db/auth-actions";
import { AuthShell } from "@/components/auth/AuthShell";
import { OtpForm } from "@/components/auth/OtpForm";
import { Button, Field, Input, Notice } from "@/components/ui/primitives";
import { IconLock, IconMail, IconShield } from "@/components/ui/icons";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { auth, refresh } = useStore();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [otp, setOtp] = useState<{ minutes?: number; devCode?: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await loginAction(email, password);
      if (res.needsVerification) {
        setOtp({ minutes: res.otpMinutes, devCode: res.devCode });
        return;
      }
      if (!res.ok) {
        setError(res.message ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      await refresh();
      router.push(res.needsProfile ? `/signup/complete?next=${encodeURIComponent(next)}` : next);
    } finally {
      setBusy(false);
    }
  };

  if (otp) {
    return (
      <AuthShell title="ยืนยันอีเมล" subtitle="อีกขั้นเดียวก่อนเข้าใช้งาน">
        <OtpForm
          email={email.trim().toLowerCase()}
          minutes={otp.minutes}
          devCode={otp.devCode}
          onVerified={async (needsProfile) => {
            await refresh();
            router.push(needsProfile ? `/signup/complete?next=${encodeURIComponent(next)}` : next);
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="เข้าสู่ระบบ"
      subtitle="ระบบจองห้องอาคาร SCB4 — ดูตารางห้องได้โดยไม่ต้องล็อกอิน แต่การจองต้องระบุตัวตน"
      footer={
        <>
          ยังไม่มีบัญชี?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="font-medium text-brand-700 hover:underline"
          >
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}

        {/* ---- SSO มหาวิทยาลัย (ยังไม่เปิด) ---- */}
        <button
          disabled
          title="รอฝ่ายไอทีเปิดสิทธิ์ให้ระบบเชื่อมกับบัญชีมหาวิทยาลัย"
          className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-ink-200 bg-ink-50 text-sm font-medium text-ink-400"
        >
          <IconShield className="h-4 w-4" />
          เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย (เร็ว ๆ นี้)
        </button>

        {/* ---- Google ---- */}
        {auth.googleEnabled ? (
          <a
            href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:bg-brand-50"
          >
            <GoogleMark /> ดำเนินการต่อด้วย Google
          </a>
        ) : (
          <p className="rounded-xl border border-dashed border-ink-200 px-3 py-2.5 text-center text-xs leading-relaxed text-ink-400">
            โหมดเดโมนี้เป็น UI ล้วน จึงยังไม่เปิดการเข้าสู่ระบบด้วย Google — ใช้ปุ่มเข้าสู่ระบบด่วนด้านบนแทน
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-ink-400">
          <span className="h-px flex-1 bg-ink-100" /> หรือใช้อีเมลและรหัสผ่าน
          <span className="h-px flex-1 bg-ink-100" />
        </div>

        <Field label="อีเมล" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@cmu.ac.th"
          />
        </Field>

        <Field label="รหัสผ่าน" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && email && password) void submit(); }}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </Field>

        <Button className="w-full" disabled={!email || !password || busy} onClick={submit}>
          {busy ? "กำลังเข้าสู่ระบบ…" : <><IconLock className="h-4 w-4" /> เข้าสู่ระบบ</>}
        </Button>

        {!auth.mailEnabled && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-400">
            <IconMail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ยังไม่ได้ต่อเซิร์ฟเวอร์อีเมล — ระหว่างนี้รหัส OTP จะแสดงบนหน้าจอเพื่อให้ทดสอบได้
          </p>
        )}
      </div>
    </AuthShell>
  );
}

/** โลโก้ Google แบบ 4 สีตามแนวทางแบรนด์ */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.3 2.6 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}
