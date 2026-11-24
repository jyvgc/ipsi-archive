"use client";
import { useMemo, useState } from "react";
import { FileMeta, ROUNDS } from "@/lib/types";

type Props = { files: FileMeta[]; selectedId?: string; favs: string[]; onSelect: (f: FileMeta) => void };

export default function Sidebar({ files, selectedId, favs, onSelect }: Props) {
  const [q, setQ] = useState("");
  const tree = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = ql ? files.filter((f) => `${f.title} ${f.category} ${f.round} ${f.year}`.toLowerCase().includes(ql)) : files;
    const t = new Map<number, Map<string, Map<string, FileMeta[]>>>();
    for (const f of list) {
      if (!t.has(f.year)) t.set(f.year, new Map());
      const y = t.get(f.year)!;
      if (!y.has(f.round)) y.set(f.round, new Map());
      const r = y.get(f.round)!;
      if (!r.has(f.category)) r.set(f.category, []);
      r.get(f.category)!.push(f);
    }
    const ro = (a: string) => { const i = ROUNDS.indexOf(a); return i < 0 ? 99 : i; };
    return [...t.entries()].sort((a, b) => b[0] - a[0]).map(([year, rm]) => ({
      year,
      rounds: [...rm.entries()].sort((a, b) => ro(a[0]) - ro(b[0]) || a[0].localeCompare(b[0], "ko")).map(([round, cm]) => ({
        round,
        cats: [...cm.entries()].sort((a, b) => a[0].localeCompare(b[0], "ko")).map(([cat, fs]) => ({ cat, fs: fs.sort((a, b) => a.title.localeCompare(b.title, "ko")) })),
      })),
    }));
  }, [files, q]);
  const open = q.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="자료 이름 검색"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand" />
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-6 text-sm">
        {tree.length === 0 && <p className="p-3 text-gray-400">자료가 없습니다.</p>}
        {tree.map((y, yi) => (
          <details key={y.year} open={open || yi === 0} className="mb-1">
            <summary className="flex items-center gap-1 rounded-lg px-2 py-2 font-bold hover:bg-brand-light">
              <span className="chev transition-transform">▸</span> {y.year}학년도
            </summary>
            {y.rounds.map((r) => (
              <details key={r.round} open className="ml-3">
                <summary className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold text-brand hover:bg-brand-light">
                  <span className="chev transition-transform">▸</span> {r.round}
                </summary>
                {r.cats.map((c) => (
                  <div key={c.cat} className="ml-4 mb-1">
                    <div className="px-2 pt-1 text-xs text-gray-400">{c.cat}</div>
                    {c.fs.map((f) => (
                      <button key={f.id} onClick={() => onSelect(f)}
                        className={`block w-full rounded-lg px-2 py-1.5 text-left leading-snug ${selectedId === f.id ? "bg-brand text-white" : "hover:bg-gray-100"}`}>
                        {favs.includes(f.id) && "★ "}{f.title}
                      </button>
                    ))}
                  </div>
                ))}
              </details>
            ))}
          </details>
        ))}
      </nav>
    </div>
  );
}
