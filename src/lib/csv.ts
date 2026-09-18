/**
 * ประกอบและดาวน์โหลดไฟล์ CSV ฝั่งเบราว์เซอร์
 *
 * รวมไว้ที่เดียวเพราะทุกหน้าที่ส่งออกข้อมูลต้องการกฎเดียวกัน:
 * ครอบเครื่องหมายคำพูดให้ถูกต้อง และใส่ BOM เพื่อให้ Excel อ่านภาษาไทยไม่เป็นตัวต่างดาว
 */

/** ค่าที่มี , " หรือขึ้นบรรทัดใหม่ ต้องถูกครอบด้วย " และ escape " ข้างในเป็น "" */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "ใช่" : "ไม่") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const content = rows.map(csvRow).join("\r\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
