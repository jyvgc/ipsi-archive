"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { getBlob, getBytes, ref } from "firebase/storage";
import AuthGate from "@/components/AuthGate";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/DataTable";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { writeLog } from "@/lib/log";
import type { FileData, FileMeta } from "@/lib/types";

export default function Home() {
  return <AuthGate><Viewer /></AuthGate>;
}

function Viewer() {
  const { email, role, signOut } = useAuth();
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [sel, setSel] = useState<FileMeta | null>(null);
  const [data, setData] = useState<FileData | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const cache = useRef(new Map<string, FileData>());
  const current = useRef("");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "files"), orderBy("year", "desc")));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FileMeta);
      setFiles(list);
      const p = await getDoc(doc(db, "userPrefs", email));
      setFavs(p.exists() ? p.data().favorites ?? [] : []);
      const fid = new URLSearchParams(location.search).get("f");
      const f = list.find((x) => x.id === fid);
      if (f) open(f);
    })().catch((e) => setErr("목록을 불러오지 못했습니다: " + e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(f: FileMeta) {
    current.current = f.id;
    setSel(f); setSheetIdx(0); setMenu(false); setErr("");
    history.replaceState(null, "", "?f=" + f.id);
    writeLog(email, "view", f);
    const c = cache.current.get(f.id);
    if (c) { setData(c); return; }
    setData(null); setLoading(true);
    try {
      const buf = await getBytes(ref(storage, f.dataPath));
      const d = JSON.parse(new TextDecoder().decode(buf)) as FileData;
      cache.current.set(f.id, d);
      if (current.current === f.id) setData(d);
    } catch (e) {
      if (current.current === f.id) setErr("파일을 불러오지 못했습니다: " + (e as Error).message);
    } finally {
      if (current.current === f.id) setLoading(false);
    }
  }

  async function download(f: FileMeta) {
    try {
      const b = await getBlob(ref(storage, f.originalPath));
      const u = URL.createObjectURL(b);
      const a = document.createElement("a"); a.href = u; a.download = f.fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
      writeLog(email, "download", f);
    } catch (e) { alert("다운로드 실패: " + (e as Error).message); }
  }

  async function toggleFav(id: string) {
    const on = favs.includes(id);
    setFavs(on ? favs.filter((x) => x !== id) : [...favs, id]);
    await setDoc(doc(db, "userPrefs", email), { favorites: on ? arrayRemove(id) : arrayUnion(id) }, { merge: true });
  }

  const favFiles = favs.map((id) => files.find((f) => f.id === id)).filter(Boolean) as FileMeta[];
  const recent = [...files].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)).slice(0, 8);
  const sheet = data?.sheets[sheetIdx];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2 bg-brand px-3 py-2.5 text-white">
        <button onClick={() => setMenu(!menu)} className="rounded-lg px-2 py-1 text-xl lg:hidden" aria-label="메뉴">☰</button>
        <button onClick={() => { setSel(null); history.replaceState(null, "", "/"); }} className="text-lg font-bold">📂 입학 자료실</button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {role === "admin" && <Link href="/admin" className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25">관리</Link>}
          <span className="hidden max-w-[180px] truncate opacity-80 sm:inline">{email}</span>
          <button onClick={signOut} className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25">로그아웃</button>
        </div>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto border-b bg-white px-3 py-2 text-sm">
        <span className="shrink-0 font-semibold text-amber-500">★ 즐겨찾기</span>
        {favFiles.length === 0 && <span className="shrink-0 text-gray-400">자료를 연 뒤 ☆를 눌러 추가하세요</span>}
        {favFiles.map((f) => (
          <button key={f.id} onClick={() => open(f)}
            className={`shrink-0 rounded-full border px-3 py-1 ${sel?.id === f.id ? "border-brand bg-brand text-white" : "hover:border-brand"}`}>
            <span className="opacity-60">{f.year} </span>{f.title}
          </button>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1">
        {menu && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenu(false)} />}
        <aside className={`z-40 w-72 shrink-0 border-r bg-white ${menu ? "fixed inset-y-0 left-0 shadow-xl" : "hidden"} lg:static lg:block`}>
          <Sidebar files={files} favs={favs} selectedId={sel?.id} onSelect={open} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col p-3 lg:p-4">
          {err && <div className="mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">{err}</div>}
          {!sel ? (
            <div className="mx-auto w-full max-w-3xl py-6">
              <h2 className="text-xl font-bold">최근 등록된 자료</h2>
              <p className="mb-4 text-sm text-gray-500">왼쪽 메뉴(모바일은 ☰)에서 연도 › 전형 › 자료를 선택하세요.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {recent.map((f) => (
                  <button key={f.id} onClick={() => open(f)} className="rounded-xl border bg-white p-4 text-left hover:border-brand hover:shadow">
                    <div className="text-xs text-brand">{f.year} · {f.round} · {f.category}</div>
                    <div className="mt-1 font-semibold">{f.title}</div>
                    <div className="mt-1 text-xs text-gray-400">시트 {f.sheetNames.length}개 · {f.rowCount.toLocaleString()}행</div>
                  </button>
                ))}
                {recent.length === 0 && <p className="text-gray-400">등록된 자료가 없습니다.</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-brand">{sel.year}학년도 · {sel.round} · {sel.category}</div>
                  <h2 className="text-lg font-bold leading-tight lg:text-xl">{sel.title}</h2>
                </div>
                <button onClick={() => toggleFav(sel.id)} className="rounded-lg border bg-white px-3 py-2 text-sm">
                  {favs.includes(sel.id) ? "★ 즐겨찾기됨" : "☆ 즐겨찾기"}
                </button>
                <button onClick={() => download(sel)} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">원본 다운로드</button>
              </div>
              {data && data.sheets.length > 1 && (
                <div className="mb-2 flex gap-1 overflow-x-auto border-b">
                  {data.sheets.map((sh, i) => (
                    <button key={i} onClick={() => setSheetIdx(i)}
                      className={`shrink-0 rounded-t-lg px-3 py-1.5 text-sm ${i === sheetIdx ? "bg-brand font-semibold text-white" : "bg-gray-100 hover:bg-gray-200"}`}>{sh.name}</button>
                  ))}
                </div>
              )}
              {loading && <div className="p-10 text-center text-gray-400">불러오는 중…</div>}
              {sheet && <DataTable key={sel.id + ":" + sheetIdx} sheet={sheet} title={sel.title} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
