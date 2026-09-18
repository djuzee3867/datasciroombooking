import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" /><path d="M9.5 20.5v-6h5v6" /></svg>
);
export const IconCalendarPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M12 13.5v4M10 15.5h4" /></svg>
);
export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 20h16" /><path d="M7 20v-6M12 20V7M17 20v-9" /></svg>
);
export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5a2.5 2.5 0 0 1 2.5 2.5z" /></svg>
);
export const IconList = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
);
export const IconBuilding = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M15 9h3a2 2 0 0 1 2 2v10" /><path d="M3 21h18M8 7h3M8 11h3M8 15h3" /></svg>
);
export const IconLayers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m12 3 8.5 4.5L12 12 3.5 7.5z" /><path d="m4 12.5 8 4.3 8-4.3" /><path d="m4 17 8 4.3 8-4.3" /></svg>
);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 1.9" /></svg>
);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.3a3.2 3.2 0 0 1 0 5.4M17.5 20a5.5 5.5 0 0 0-2-4.3" /></svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m14 6-6 6 6 6" /></svg>
);
export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m10 6 6 6-6 6" /></svg>
);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3l7 3v5.5c0 4.4-2.9 8.3-7 9.5-4.1-1.2-7-5.1-7-9.5V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconKey = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="8" cy="14" r="4" /><path d="m11 11 8-8 2 2-2 2 1.5 1.5L18 11l-2-2-2 2" /></svg>
);
export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="4.5" y="10" width="15" height="11" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></svg>
);
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9z" /><path d="M10 18.5a2 2 0 0 0 4 0" /></svg>
);
export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 4h3.5l1.7 4-2.1 1.5a12 12 0 0 0 5.4 5.4L15 12.8l4 1.7V18a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3 6.2 2 2 0 0 1 5 4z" /></svg>
);
export const IconMail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 5.5L20 7" /></svg>
);
export const IconDoc = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M13 3v5h5M8.5 13h7M8.5 16.5h4.5" /></svg>
);
export const IconPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>
);
export const IconWarn = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4 2.8 20h18.4z" /><path d="M12 10v4M12 17.2h.01" /></svg>
);
export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9z" /></svg>
);
export const IconRefresh = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 11a8 8 0 0 0-14-4.5L4 9" /><path d="M4 5v4h4" /><path d="M4 13a8 8 0 0 0 14 4.5L20 15" /><path d="M20 19v-4h-4" /></svg>
);
export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4v10M8 11l4 4 4-4" /><path d="M5 19h14" /></svg>
);
export const IconBan = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="m6 6 12 12" /></svg>
);

/* ---- อุปกรณ์ในห้อง ---- */
const EQUIPMENT_ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  projector: (p) => (
    <svg {...base(p)}><rect x="2.5" y="7.5" width="19" height="9" rx="2.5" /><circle cx="9" cy="12" r="2.6" /><path d="M16.5 11h2M5 16.5V19M19 16.5V19" /></svg>
  ),
  tv: (p) => (
    <svg {...base(p)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
  ),
  mic: (p) => (
    <svg {...base(p)}><rect x="9" y="3" width="6" height="10" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" /></svg>
  ),
  sound: (p) => (
    <svg {...base(p)}><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" /></svg>
  ),
  board: (p) => (
    <svg {...base(p)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v5M8 21h8M7 8.5h6M7 12h4" /></svg>
  ),
  computer: (p) => (
    <svg {...base(p)}><rect x="3" y="4.5" width="18" height="11" rx="2" /><path d="M2 19h20M9.5 15.5 9 19M14.5 15.5l.5 3.5" /></svg>
  ),
  aircon: (p) => (
    <svg {...base(p)}><rect x="3" y="4" width="18" height="7" rx="2.5" /><path d="M6.5 8h11M7 14.5c0 1.5 1.5 1.5 1.5 3M12 14.5c0 1.5 1.5 1.5 1.5 3M17 14.5c0 1.5-1.5 1.5-1.5 3" /></svg>
  ),
  camera: (p) => (
    <svg {...base(p)}><rect x="2.5" y="6.5" width="12.5" height="11" rx="2.5" /><path d="m15 11.5 6-3v7l-6-3z" /></svg>
  ),
  hdmi: (p) => (
    <svg {...base(p)}><path d="M4 8.5h16v4l-2.5 3h-11L4 12.5z" /><path d="M8 8.5V6h8v2.5" /></svg>
  ),
  podium: (p) => (
    <svg {...base(p)}><path d="M7 8h10l-1.2 12H8.2z" /><path d="M5.5 5h13l-.6 3H6.1z" /><path d="M12 8v12" /></svg>
  ),
};

export function EquipmentIcon({ icon, className }: { icon: string; className?: string }) {
  const C = EQUIPMENT_ICONS[icon];
  if (!C) return <IconSparkle className={className} />;
  return C({ className });
}
