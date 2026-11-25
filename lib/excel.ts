import * as XLSX from "xlsx";
import type { Cell, FileData, SheetData } from "./types";

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
    const sh: SheetData = { name, columns, rows };
    return headerRow === 1 ? refineSheet(sh) : { ...sh, refined: true };
  });
  return { sheets };
}

const isGen = (c: string) => /^열\d+(\(\d+\))?$/.test(c);
const filled = (r: Cell[]) => r.filter((v) => v !== null).length;

/** 엑셀 맨 위 제목 줄을 분리하고, 2줄 머리글(예: 연번·학과 / 정원·1차정원)을 합쳐 열 이름으로 만든다.
 *  이미 올린 자료에도 열람 시 적용되므로 다시 올릴 필요가 없다. */
export function refineSheet(sh: SheetData): SheetData {
  if (sh.refined) return sh;
  const width = sh.columns.length;
  if (width < 2) return { ...sh, refined: true };
  const named = sh.columns.filter((c) => !isGen(c));
  if (named.length !== 1) return { ...sh, refined: true }; // 정상 머리글로 판단
  const titles = [named[0]];
  const rows = [...sh.rows];
  // 추가 제목 줄(값이 1칸뿐인 줄) 분리
  while (rows.length > 1 && filled(rows[0]) === 1 && width > 2) titles.push(String(rows.shift()!.find((v) => v !== null)));
  if (!rows.length) return { ...sh, refined: true };
  const heads: Cell[][] = [rows.shift()!];
  // 숫자가 없는 다음 줄은 머리글 둘째 줄로 보고 합침 (최대 2줄 추가)
  while (heads.length < 3 && rows.length > 1 && filled(rows[0]) > 0 && rows[0].every((v) => v === null || typeof v === "string")) {
    const nums = rows[1].some((v) => typeof v === "number");
    if (!nums && heads.length > 1) break;
    heads.push(rows.shift()!);
  }
  const seen = new Map<string, number>();
  const columns = Array.from({ length: width }, (_, i) => {
    const parts = heads.map((h) => h[i]).filter((v) => v !== null).map((v) => String(v).replace(/\s+/g, " "));
    const h = parts.length ? [...new Set(parts)].join(" ") : `열${i + 1}`;
    const n = (seen.get(h) ?? 0) + 1; seen.set(h, n);
    return n > 1 ? `${h}(${n})` : h;
  });
  // 완전히 빈 열 제거
  const keep = columns.map((_, i) => !isGen(columns[i]) || rows.some((r) => r[i] !== null));
  return {
    name: sh.name, title: titles.join(" · "), refined: true,
    columns: columns.filter((_, i) => keep[i]),
    rows: rows.map((r) => r.filter((_, i) => keep[i])).filter((r) => r.some((v) => v !== null)),
  };
}
