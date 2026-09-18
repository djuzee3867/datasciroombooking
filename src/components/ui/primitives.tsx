"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Card ---------------- */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(27,22,38,.04),0_12px_32px_-24px_rgba(27,22,38,.35)]",
        padded && "p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---------------- Button ---------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "inverse" | "outlineLight";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-45";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
  ghost: "text-ink-500 hover:bg-ink-50 hover:text-ink-900",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  // สองแบบล่างใช้บนพื้นหลังสีเข้ม (hero)
  inverse: "bg-white text-brand-700 shadow-sm hover:bg-brand-50",
  outlineLight:
    "border border-white/35 bg-white/10 text-white backdrop-blur hover:border-white/60 hover:bg-white/20",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...rest}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      {...rest}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    />
  );
}

/* ---------------- Badge ---------------- */

export function Badge({
  children,
  className,
  dot,
}: {
  children: ReactNode;
  className?: string;
  dot?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        className ?? "bg-ink-50 text-ink-700 ring-ink-200",
      )}
    >
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

/* ---------------- Form fields ---------------- */

export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
      {error && (
        <span className="mt-1.5 flex items-start gap-1 text-xs font-medium text-rose-600">
          <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current" aria-hidden>
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.2a.8.8 0 01.8.8v3.6a.8.8 0 11-1.6 0V5a.8.8 0 01.8-.8zm0 7.9a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
          {error}
        </span>
      )}
    </label>
  );
}

const CONTROL =
  "w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 hover:border-ink-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-400";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input {...rest} className={cx(CONTROL, "h-11", className)} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea {...rest} className={cx(CONTROL, "min-h-24 py-2.5 leading-relaxed", className)} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...rest} className={cx(CONTROL, "h-11 appearance-none pr-10", className)}>
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-ink-400 stroke-[1.8]"
        aria-hidden
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ---------------- Empty / info states ---------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-ink-50/60 px-6 py-12 text-center">
      {icon ?? (
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-ink-400 ring-1 ring-ink-200">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.6]" aria-hidden>
            <rect x="3" y="4" width="18" height="17" rx="3" />
            <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <div>
        <p className="font-medium text-ink-700">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "error" | "success";
  title?: ReactNode;
  children: ReactNode;
}) {
  const tones = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;
  return (
    <div className={cx("rounded-xl border px-4 py-3 text-sm leading-relaxed", tones[tone])}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

/* ---------------- Tabs ---------------- */

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div
      role="tablist"
      className="thin-scroll flex gap-1 overflow-x-auto rounded-xl bg-ink-50 p-1"
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cx(
              "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              active ? "bg-white text-brand-700 shadow-sm" : "text-ink-500 hover:text-ink-900",
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                className={cx(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-brand-100 text-brand-700" : "bg-ink-200/70 text-ink-500",
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  xl,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** กว้างพิเศษ — ใช้กับพรีวิวเอกสารที่ต้องอ่านตัวหนังสือในไฟล์ได้ */
  xl?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="ปิดหน้าต่าง"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/35 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "animate-rise relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl",
          xl ? "sm:max-w-5xl" : wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-900"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Stat tile ---------------- */

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: "brand" | "emerald" | "amber" | "slate";
}) {
  const tones = {
    brand: "text-brand-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    slate: "text-ink-700",
  } as const;
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <p className="text-xs font-medium text-ink-400">{label}</p>
      <p className={cx("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", tones[tone])}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-ink-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
