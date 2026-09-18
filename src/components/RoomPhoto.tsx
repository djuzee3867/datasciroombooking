"use client";

import { useState } from "react";
import { cx } from "@/components/ui/primitives";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";

/**
 * รูปห้องจำลอง — prototype ยังไม่มีภาพจริง จึงวาดด้วย CSS ให้เห็นโครงหน้าตาไปก่อน
 * ของจริงจะเปลี่ยนเป็น <Image> จาก unitImages โดยไม่กระทบ layout รอบข้าง
 */
export function RoomPhoto({
  seed,
  code,
  className,
  label,
}: {
  seed: string;
  code: string;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden bg-cover",
        seed === "a" ? "room-photo-a" : seed === "b" ? "room-photo-b" : "room-photo-c",
        className,
      )}
      role="img"
      aria-label={label ?? `ภาพจำลองห้อง ${code}`}
    >
      <span className="room-photo-overlay absolute inset-0" aria-hidden />
      <span
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent"
        aria-hidden
      />
      <span className="absolute bottom-2 left-3 text-[11px] font-semibold tracking-wide text-white/90">
        {code}
      </span>
    </div>
  );
}

export function RoomGallery({ images, code }: { images: string[]; code: string }) {
  const [i, setI] = useState(0);
  const list = images.length ? images : ["a"];
  const go = (d: number) => setI((v) => (v + d + list.length) % list.length);

  return (
    <div className="relative">
      <RoomPhoto seed={list[i]} code={code} className="aspect-[16/9] w-full rounded-xl" />
      {list.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="ภาพก่อนหน้า"
            className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink-700 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="ภาพถัดไป"
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink-700 shadow-sm backdrop-blur transition hover:bg-white"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {list.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`ไปที่ภาพที่ ${idx + 1}`}
                className={cx(
                  "h-1.5 rounded-full transition-all",
                  idx === i ? "w-5 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
