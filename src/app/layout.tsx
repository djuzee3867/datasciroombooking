import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DS Room Booking · ระบบจองห้อง SCB4",
    template: "%s · DS Room Booking",
  },
  description:
    "ระบบจองห้องประชุมและห้องเรียนอาคาร SCB4 คณะวิทยาศาสตร์ข้อมูล — ดูตารางห้องได้โดยไม่ต้องล็อกอิน จองออนไลน์ได้ตลอด 24 ชั่วโมง",
};

export const viewport: Viewport = {
  themeColor: "#7038e0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${thai.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-white font-sans">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
