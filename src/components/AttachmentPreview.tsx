"use client";

/**
 * เอกสารแนบของคำขอจอง — แถบไฟล์ + หน้าต่างพรีวิวเต็มจอ (§8.3)
 *
 * ไฟล์ถูกดึงมาเป็น Blob พร้อมคุกกี้เซสชัน แล้วสร้าง object URL ใช้ในหน้าเดียวกัน
 * จึงพรีวิวได้โดยไม่ต้องเปิด URL ที่ใครก็กดได้ และเซิร์ฟเวอร์ยังตรวจสิทธิ์ทุกครั้ง
 *
 * ทำไมไม่ใช้ <Modal> ตัวกลาง: พรีวิวเอกสารต้องใช้พื้นที่ทั้งจอ และต้องมี
 * "พื้นที่เลื่อนเดียว" คือตัวเอกสารเท่านั้น ถ้าเอาไปวางใน modal ที่สูงจำกัด
 * จะได้แถบเลื่อนซ้อนกันสองชั้นและหัว–ท้ายโดนตัด (อาการที่เจอตอนแรก)
 *
 * โหลดไฟล์ตอน "กดปุ่ม" ไม่ใช่ตอน mount — เอกสารมีขนาดหลาย MB
 * และผู้อนุมัติส่วนใหญ่ดูรายละเอียดโดยไม่เปิดไฟล์
 */

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { Badge, Button, cx } from "@/components/ui/primitives";
import { IconDoc, IconDownload, IconSearch, IconX } from "@/components/ui/icons";

export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const typeLabel = (mime: string) =>
  mime === "application/pdf" ? "PDF" : mime === "image/png" ? "PNG" : "JPG";

/* ------------------------------------------------- แถบไฟล์ในหน้ารายละเอียด */

export function AttachmentCard({ booking }: { booking: Booking }) {
  const { actions } = useStore();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking.attachmentName) {
    return (
      <div className="rounded-xl border border-ink-100 p-3">
        <p className="text-xs text-ink-400">เอกสารแนบ</p>
        <p className="mt-0.5 text-sm text-ink-500">ไม่มี</p>
      </div>
    );
  }

  const mime = booking.attachmentMime ?? "application/pdf";
  const fileName = booking.attachmentName;

  /** โหลดไฟล์ครั้งเดียวแล้วใช้ object URL เดิมซ้ำทั้งพรีวิวและดาวน์โหลด */
  const ensureUrl = async (): Promise<string | null> => {
    if (objectUrl) return objectUrl;
    if (!booking.attachmentId) return null;
    setBusy(true);
    setError(null);
    try {
      const blob = await actions.fetchAttachment(booking.attachmentId);
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "เปิดเอกสารไม่สำเร็จ");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    if (await ensureUrl()) setOpen(true);
  };

  const download = async () => {
    const url = await ensureUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <p className="text-xs text-ink-400">เอกสารแนบ</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium break-words text-ink-900">
          <IconDoc className="h-4 w-4 shrink-0 text-brand-600" />
          {fileName}
          {booking.attachmentSize !== null && (
            <Badge className="bg-ink-50 text-ink-600 ring-ink-200">
              {typeLabel(mime)} · {fileSizeLabel(booking.attachmentSize)}
            </Badge>
          )}
        </p>
        {booking.attachmentId ? (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={preview}>
              {busy ? "กำลังเปิด…" : "พรีวิว"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={download}>
              <IconDownload className="h-3.5 w-3.5" /> ดาวน์โหลด
            </Button>
          </div>
        ) : (
          <Badge className="bg-amber-50 text-amber-800 ring-amber-200">
            มีแต่ชื่อไฟล์ · อัปโหลดก่อนระบบเก็บไฟล์จริง
          </Badge>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {open && objectUrl && (
        <AttachmentViewer
          url={objectUrl}
          fileName={fileName}
          mime={mime}
          size={booking.attachmentSize}
          onDownload={download}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------ หน้าต่างพรีวิวเต็มจอ */

function AttachmentViewer({
  url,
  fileName,
  mime,
  size,
  onClose,
  onDownload,
}: {
  url: string;
  fileName: string;
  mime: string;
  size: number | null;
  onClose: () => void;
  onDownload: () => void;
}) {
  const isImage = mime.startsWith("image/");
  const [zoom, setZoom] = useState(1);

  // กด Esc เพื่อปิด และล็อกไม่ให้หน้าเบื้องหลังเลื่อนตามขณะเปิดอยู่
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    // z สูงกว่า Modal (z-50) เพราะพรีวิวถูกเปิดจากในหน้าต่างรายละเอียดการจอง
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-900/70 backdrop-blur-sm">
      {/* คลิกพื้นหลังเพื่อปิด — ปุ่มเต็มพื้นที่ที่อยู่ใต้เนื้อหา */}
      <button
        aria-label="ปิดหน้าต่างพรีวิว"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`ตัวอย่างเอกสารแนบ ${fileName}`}
        className="animate-rise relative mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl"
      >
        {/* ---------------- หัวหน้าต่าง ----------------
            จอเล็กแยกเป็น 2 แถว (ชื่อไฟล์ / ปุ่ม) จอกว้างรวมเป็นแถวเดียว
            ถ้ายัดแถวเดียวบนมือถือ ชื่อไฟล์จะถูกบีบจนเหลือไม่กี่ตัวอักษร */}
        <header className="flex shrink-0 flex-col gap-2 border-b border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <IconDoc className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900" title={fileName}>
                {fileName}
              </p>
              <p className="truncate text-xs text-ink-400">
                {typeLabel(mime)}
                {size !== null && ` · ${fileSizeLabel(size)}`}
                <span className="hidden sm:inline">
                  {" · เอกสารภายใน เห็นได้เฉพาะผู้จอง และแอดมิน"}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="ปิด"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-400 transition hover:bg-ink-50 hover:text-ink-900 sm:hidden"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:ml-auto sm:shrink-0">
            {isImage && (
              <div className="mr-1 hidden items-center gap-1 rounded-xl border border-ink-200 p-0.5 sm:flex">
                <ZoomButton label="ย่อ" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
                  −
                </ZoomButton>
                <span className="w-12 text-center text-xs tabular-nums text-ink-500">
                  {Math.round(zoom * 100)}%
                </span>
                <ZoomButton label="ขยาย" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
                  +
                </ZoomButton>
                <ZoomButton label="ขนาดพอดี" onClick={() => setZoom(1)}>
                  <IconSearch className="h-3.5 w-3.5" />
                </ZoomButton>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => window.open(url, "_blank")}
            >
              เปิดแท็บใหม่
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={onDownload}>
              <IconDownload className="h-3.5 w-3.5" /> ดาวน์โหลด
            </Button>
            <button
              onClick={onClose}
              aria-label="ปิด"
              className="ml-0.5 hidden h-9 w-9 place-items-center rounded-xl text-ink-400 transition hover:bg-ink-50 hover:text-ink-900 sm:grid"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ---------------- ตัวเอกสาร (พื้นที่เลื่อนเดียวของหน้าต่างนี้) ---------------- */}
        <div className={cx("min-h-0 flex-1 bg-ink-100", isImage && "overflow-auto p-4")}>
          {isImage ? (
            <div className="flex min-h-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URL ในเครื่อง next/image ใช้ไม่ได้ */}
              <img
                src={url}
                alt={`ตัวอย่างเอกสารแนบ ${fileName}`}
                style={{ width: `${zoom * 100}%` }}
                className="h-auto max-w-none rounded-lg bg-white shadow-sm transition-[width]"
              />
            </div>
          ) : (
            // #toolbar=0 ซ่อนแถบเครื่องมือของตัวอ่าน PDF ในเบราว์เซอร์
            // จะได้เหลือแถบเครื่องมือชุดเดียวคือของหน้าต่างนี้ ไม่ซ้อนกันจนสับสน
            <iframe
              src={`${url}#toolbar=0&navpanes=0&view=FitH`}
              title={`ตัวอย่างเอกสารแนบ ${fileName}`}
              className="h-full w-full border-0"
            />
          )}
        </div>

        {/* ---------------- ท้ายหน้าต่าง ---------------- */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-ink-100 px-4 py-2.5 sm:px-5">
          {/* คำใบ้แป้น Esc ไม่มีประโยชน์บนมือถือ — ซ่อนไว้เฉพาะจอเล็ก */}
          <p className="hidden text-xs text-ink-400 sm:block">
            กด <kbd className="rounded border border-ink-200 px-1 font-sans">Esc</kbd> เพื่อปิด ·
            ถ้าเบราว์เซอร์แสดงตัวอย่างไม่ได้ ให้กดดาวน์โหลดไฟล์
          </p>
          <p className="text-xs text-ink-400 sm:hidden">เอกสารภายใน · อย่าเผยแพร่ต่อ</p>
          <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
        </footer>
      </div>
    </div>
  );
}

function ZoomButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-lg text-sm text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
    >
      {children}
    </button>
  );
}
