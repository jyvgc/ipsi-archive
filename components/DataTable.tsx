"use client";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { Cell, SheetData } from "@/lib/types";

const PAGE = 100;
const s = (v: Cell) => (v === null ? "" : String(v));
const fmt = (v: Cell) => (typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("ko-KR") : String(Math.round(v * 1000) / 1000)) : s(v));

export default function DataTable({ sheet, title }: { sheet: SheetData; title: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ c: number; d: 1 | -1 } | null>(null);
  const [filters, setFilters] = useState<Record<number, Set<string>>>({});
  const [fcol, setFcol] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const fk = Object.keys(filters).map(Number);
    let r = sheet.rows.filter((row) => {
      for (const k of fk) if (!filters[k].has(s(row[k]))) return false;
      return !ql || row.some((v) => s(v).toLowerCase().includes(ql));
    });
    if (sort) {
      const { c, d } = sort;
      r = [...r].sort((a, b) => {
        const x = a[c], y = b[c];
        if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
        if (typeof x === "number" && typeof y === "number") return (x - y) * d;
        return String(x).localeCompare(String(y), "ko", { numeric: true }) * d;
      });
    }
    return r;
  }, [sheet, q, sort, filters]);

  useEffect(() => setPage(0), [q, sort, filters]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const nf = Object.keys(filters).length;

  const clickSort = (c: number) => setSort((p) => (!p || p.c !== c ? { c, d: 1 } : p.d === 1 ? { c, d: -1 } : null));
  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([sheet.columns, ...rows]), sheet.name.slice(0, 31));
    XLSX.writeFile(wb, `${title}_${sheet.name}_조회결과.xlsx`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="전체 검색 (학교명, 학과 등)"
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand sm:max-w-xs" />
        <span className="text-sm text-gray-500"><b className="text-gray-800">{rows.length.toLocaleString()}</b> / {sheet.rows.length.toLocaleString()}행</span>
        {(nf > 0 || sort || q) && (
          <button onClick={() => { setFilters({}); setSort(null); setQ(""); }} className="rounded-lg border px-2 py-1.5 text-xs">초기화{nf > 0 && ` (필터 ${nf})`}</button>
        )}
        <button onClick={exportXlsx} className="ml-auto rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50">현재 결과 엑셀 저장</button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 border-b bg-gray-100 px-2 py-2 text-xs text-gray-400">#</th>
              {sheet.columns.map((c, i) => (
                <th key={i} className={`sticky top-0 z-20 whitespace-nowrap border-b border-l px-2 py-2 text-left font-semibold ${filters[i] ? "bg-brand-light" : "bg-gray-100"}`}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => clickSort(i)} className="text-left hover:text-brand">
                      {c}{sort?.c === i && (sort.d === 1 ? " ▲" : " ▼")}
                    </button>
                    <button onClick={() => setFcol(i)} title="열 필터"
                      className={`rounded px-1 text-xs ${filters[i] ? "bg-brand text-white" : "text-gray-400 hover:bg-gray-200"}`}>⏷</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, ri) => (
              <tr key={ri} className="odd:bg-white even:bg-gray-50 hover:bg-yellow-50">
                <td className="sticky left-0 z-10 border-b bg-inherit px-2 py-1.5 text-right text-xs text-gray-400">{page * PAGE + ri + 1}</td>
                {r.map((v, ci) => (
                  <td key={ci} className={`whitespace-nowrap border-b border-l px-2 py-1.5 ${typeof v === "number" ? "text-right tabular-nums" : ""}`}>{fmt(v)}</td>
                ))}
              </tr>
            ))}
            {view.length === 0 && <tr><td colSpan={sheet.columns.length + 1} className="p-8 text-center text-gray-400">조건에 맞는 데이터가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 text-sm">
          <button disabled={page === 0} onClick={() => setPage(0)} className="rounded border px-2 py-1 disabled:opacity-30">«</button>
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-30">이전</button>
          <span>{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-30">다음</button>
          <button disabled={page >= pages - 1} onClick={() => setPage(pages - 1)} className="rounded border px-2 py-1 disabled:opacity-30">»</button>
        </div>
      )}

      {fcol !== null && (
        <FilterModal col={sheet.columns[fcol]} values={sheet.rows.map((r) => s(r[fcol]))} current={filters[fcol]}
          onClose={() => setFcol(null)}
          onApply={(set) => {
            setFilters((p) => { const n = { ...p }; if (set) n[fcol] = set; else delete n[fcol]; return n; });
            setFcol(null);
          }} />
      )}
    </div>
  );
}

function FilterModal({ col, values, current, onClose, onApply }: {
  col: string; values: string[]; current?: Set<string>; onClose: () => void; onApply: (s: Set<string> | null) => void;
}) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "ko", { numeric: true }));
  }, [values]);
  const [sel, setSel] = useState<Set<string>>(() => new Set(current ?? counts.map((c) => c[0])));
  const [q, setQ] = useState("");
  const shown = counts.filter(([v]) => v.toLowerCase().includes(q.toLowerCase())).slice(0, 1000);
  const toggle = (v: string) => setSel((p) => { const n = new Set(p); n.has(v) ? n.delete(v) : n.add(v); return n; });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 font-bold">‘{col}’ 필터</h3>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="값 검색" className="mb-2 rounded-lg border px-3 py-2 text-sm" />
        <div className="mb-2 flex gap-2 text-xs">
          <button onClick={() => setSel(new Set([...sel, ...shown.map((c) => c[0])]))} className="rounded border px-2 py-1">보이는 항목 전체 선택</button>
          <button onClick={() => { const n = new Set(sel); shown.forEach(([v]) => n.delete(v)); setSel(n); }} className="rounded border px-2 py-1">보이는 항목 해제</button>
        </div>
        <div className="flex-1 overflow-y-auto rounded-lg border">
          {shown.map(([v, n]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-0 hover:bg-gray-50">
              <input type="checkbox" checked={sel.has(v)} onChange={() => toggle(v)} className="h-4 w-4 accent-brand" />
              <span className="flex-1 truncate">{v === "" ? <i className="text-gray-400">(빈 값)</i> : v}</span>
              <span className="text-xs text-gray-400">{n}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => onApply(null)} className="flex-1 rounded-xl border py-2.5 text-sm">필터 해제</button>
          <button onClick={() => onApply(sel.size === counts.length ? null : sel)} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white">적용</button>
        </div>
      </div>
    </div>
  );
}
