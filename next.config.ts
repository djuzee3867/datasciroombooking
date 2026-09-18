import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ล็อก root ไว้ที่โฟลเดอร์โปรเจกต์ เพื่อไม่ให้ Turbopack ไปหยิบ lockfile ของโฟลเดอร์แม่
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
