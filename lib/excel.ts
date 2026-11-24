import * as XLSX from "xlsx";
import type { Cell, FileData } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
function norm(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const d = `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    return v.getHours() || v.getMinutes() ? `${d} ${pad(v.getHours())}:${pad(v.getMinutes())}` : d;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") { const t = v.trim(); return t === "" ? null : t; }
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

/** headerRow: 머리글이 있는 행 번호(1부터). 모든 시트에 동일 적용 */
export function parseWorkbook(buf: ArrayBuffer, headerRow = 1): FileData {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheets = wb.SheetNames.map((name) => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: false });
    const hi = Math.max(0, headerRow - 1);
    const head = aoa[hi] ?? [];
    const body = aoa.slice(hi + 1);
    const width = body.reduce((m, r) => Math.max(m, r.length), head.length);
    const seen = new Map<string, number>();
    const columns = Array.from({ length: width }, (_, i) => {
      const raw = norm(head[i]);
      const h = raw === null ? `열${i + 1}` : String(raw).replace(/\s+/g, " ");
      const n = (seen.get(h) ?? 0) + 1; seen.set(h, n);
      return n > 1 ? `${h}(${n})` : h;
    });
    const rows = body
      .map((r) => Array.from({ length: width }, (_, i) => norm(r[i])))
      .filter((r) => r.some((v) => v !== null));
    return { name, columns, rows };
  });
  return { sheets };
}
