"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import AuthGate from "@/components/AuthGate";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { parseWorkbook } from "@/lib/excel";
import { writeLog } from "@/lib/log";
import { CATEGORIES, ROUNDS, type FileData, type FileMeta } from "@/lib/types";

export default function AdminPage() {
  return <AuthGate adminOnly><Admin /></AuthGate>;
}

const TABS = ["자료 업로드", "자료 관리", "사용자 관리", "열람 로그"] as const;
const input = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand";

function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("자료 업로드");
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-3 bg-brand px-4 py-3 text-white">
        <Link href="/" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm">← 자료실</Link>
        <h1 className="text-lg font-bold">관리자</h1>
      </header>
      <div className="flex gap-1 overflow-x-auto border-b bg-white px-3 pt-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 rounded-t-lg px-4 py-2 text-sm ${tab === t ? "bg-brand font-semibold text-white" : "hover:bg-gray-100"}`}>{t}</button>
        ))}
      </div>
      <div className="mx-auto max-w-4xl p-4">
        {tab === "자료 업로드" && <Upload />}
        {tab === "자료 관리" && <Manage />}
        {tab === "사용자 관리" && <Users />}
        {tab === "열람 로그" && <Logs />}
      </div>
    </div>
  );
}

function Upload() {
  const { email } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [parsed, setParsed] = useState<FileData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [round, setRound] = useState(ROUNDS[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!buf) { setParsed(null); return; }
    try { setParsed(parseWorkbook(buf, headerRow)); setMsg(""); }
    catch (e) { setParsed(null); setMsg("엑셀을 읽을 수 없습니다: " + (e as Error).message); }
  }, [buf, headerRow]);

  async function pick(f: File | null) {
    setFile(f); setBuf(f ? await f.arrayBuffer() : null);
    if (f && !title) setTitle(f.name.replace(/\.(xlsx|xls|csv)$/i, ""));
  }

  async function submit() {
    if (!file || !parsed || !title.trim()) return setMsg("파일과 제목을 확인하세요.");
    setBusy(true); setMsg("업로드 중…");
    try {
      const id = doc(collection(db, "files")).id;
      const ext = file.name.split(".").pop()?.toLowerCase() || "xlsx";
      const originalPath = `files/${id}/original.${ext}`;
      const dataPath = `files/${id}/data.json`;
      await uploadBytes(ref(storage, originalPath), file, { contentType: file.type || "application/octet-stream" });
      await uploadBytes(ref(storage, dataPath), new Blob([JSON.stringify(parsed)], { type: "application/json" }), { contentType: "application/json" });
      const meta: Omit<FileMeta, "id" | "createdAt"> = {
        year: Number(year), round, category: category.trim() || "기타", title: title.trim(), fileName: file.name,
        sheetNames: parsed.sheets.map((s) => s.name), rowCount: parsed.sheets.reduce((n, s) => n + s.rows.length, 0),
        originalPath, dataPath, uploadedBy: email,
      };
      await setDoc(doc(db, "files", id), { ...meta, createdAt: serverTimestamp() });
      writeLog(email, "upload", { id, title: meta.title });
      setMsg(`✅ ‘${meta.title}’ 등록 완료`);
      setFile(null); setBuf(null); setTitle("");
      (document.getElementById("xl") as HTMLInputElement).value = "";
    } catch (e) { setMsg("❌ 실패: " + (e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-semibold">엑셀 파일 (xlsx, xls, csv)</label>
        <input id="xl" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => pick(e.target.files?.[0] ?? null)} className="text-sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="mb-1 block text-sm font-semibold">학년도</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={input} /></div>
        <div><label className="mb-1 block text-sm font-semibold">전형</label>
          <select value={round} onChange={(e) => setRound(e.target.value)} className={input}>{ROUNDS.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label className="mb-1 block text-sm font-semibold">자료 종류</label>
          <input list="cats" value={category} onChange={(e) => setCategory(e.target.value)} className={input} />
          <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></div>
      </div>
      <div><label className="mb-1 block text-sm font-semibold">제목</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 최근2년간 수시1차 학과별 지원" className={input} /></div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold">머리글(열 이름) 행 번호</label>
        <input type="number" min={1} value={headerRow} onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value)))} className="w-20 rounded-lg border px-2 py-1.5 text-sm" />
        <span className="text-xs text-gray-400">1이면 제목 줄·2줄 머리글을 자동 인식합니다. 결과가 이상할 때만 바꾸세요</span>
      </div>

      {parsed && (
        <div className="rounded-xl border bg-gray-50 p-3 text-sm">
          <div className="mb-2 font-semibold">미리보기</div>
          {parsed.sheets.map((s) => (
            <div key={s.name} className="mb-2">
              {s.title && <div className="text-xs text-brand">제목 줄: {s.title}</div>}
              <div><b>{s.name}</b> · {s.rows.length.toLocaleString()}행 · {s.columns.length}열</div>
              <div className="truncate text-xs text-gray-500">열: {s.columns.slice(0, 15).join(", ")}{s.columns.length > 15 && " …"}</div>
            </div>
          ))}
        </div>
      )}
      <button disabled={busy || !parsed} onClick={submit}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-40">{busy ? "업로드 중…" : "등록하기"}</button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

function Manage() {
  const { email } = useAuth();
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [edit, setEdit] = useState<FileMeta | null>(null);
  const load = async () => {
    const s = await getDocs(query(collection(db, "files"), orderBy("year", "desc")));
    setFiles(s.docs.map((d) => ({ id: d.id, ...d.data() }) as FileMeta));
  };
  useEffect(() => { load(); }, []);

  async function remove(f: FileMeta) {
    if (!confirm(`‘${f.title}’을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await Promise.allSettled([deleteObject(ref(storage, f.originalPath)), deleteObject(ref(storage, f.dataPath))]);
    await deleteDoc(doc(db, "files", f.id));
    writeLog(email, "delete", f);
    load();
  }
  async function save() {
    if (!edit) return;
    await updateDoc(doc(db, "files", edit.id), { year: Number(edit.year), round: edit.round, category: edit.category, title: edit.title });
    setEdit(null); load();
  }

  return (
    <div className="space-y-2">
      {files.map((f) => edit?.id === f.id ? (
        <div key={f.id} className="grid gap-2 rounded-xl border-2 border-brand bg-white p-3 sm:grid-cols-5">
          <input type="number" value={edit.year} onChange={(e) => setEdit({ ...edit, year: Number(e.target.value) })} className={input} />
          <select value={edit.round} onChange={(e) => setEdit({ ...edit, round: e.target.value })} className={input}>{ROUNDS.map((r) => <option key={r}>{r}</option>)}</select>
          <input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className={input} />
          <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={`${input} sm:col-span-2`} />
          <div className="flex gap-2 sm:col-span-5">
            <button onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm text-white">저장</button>
            <button onClick={() => setEdit(null)} className="rounded-lg border px-4 py-2 text-sm">취소</button>
          </div>
        </div>
      ) : (
        <div key={f.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-brand">{f.year} · {f.round} · {f.category}</div>
            <div className="truncate font-semibold">{f.title}</div>
            <div className="text-xs text-gray-400">{f.fileName} · {f.rowCount.toLocaleString()}행</div>
          </div>
          <button onClick={() => setEdit(f)} className="rounded-lg border px-3 py-1.5 text-sm">수정</button>
          <button onClick={() => remove(f)} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600">삭제</button>
        </div>
      ))}
      {files.length === 0 && <p className="text-gray-400">등록된 자료가 없습니다.</p>}
    </div>
  );
}

type U = { email: string; role: "admin" | "viewer"; name?: string };
function Users() {
  const { email: me } = useAuth();
  const [users, setUsers] = useState<U[]>([]);
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [role, setRole] = useState<U["role"]>("viewer");
  const load = async () => {
    const s = await getDocs(collection(db, "allowedUsers"));
    setUsers(s.docs.map((d) => ({ email: d.id, ...d.data() }) as U).sort((a, b) => a.email.localeCompare(b.email)));
  };
  useEffect(() => { load(); }, []);
  async function add() {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return alert("이메일 형식을 확인하세요.");
    await setDoc(doc(db, "allowedUsers", e), { role, name: name.trim(), addedBy: me, addedAt: serverTimestamp() });
    setEmail(""); setName(""); load();
  }
  async function del(u: U) {
    if (u.email === me) return alert("본인 계정은 삭제할 수 없습니다.");
    if (confirm(`${u.email} 접근 권한을 삭제할까요?`)) { await deleteDoc(doc(db, "allowedUsers", u.email)); load(); }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="구글 이메일" className={input} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름/부서(선택)" className={input} />
        <select value={role} onChange={(e) => setRole(e.target.value as U["role"])} className={input}>
          <option value="viewer">열람자</option><option value="admin">관리자</option>
        </select>
        <button onClick={add} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">추가</button>
      </div>
      {users.map((u) => (
        <div key={u.email} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
          <div className="min-w-0 flex-1"><div className="truncate font-medium">{u.email}</div><div className="text-xs text-gray-400">{u.name}</div></div>
          <span className={`rounded-full px-2 py-0.5 text-xs ${u.role === "admin" ? "bg-brand text-white" : "bg-gray-100"}`}>{u.role === "admin" ? "관리자" : "열람자"}</span>
          <button onClick={() => del(u)} className="rounded-lg border px-3 py-1.5 text-sm text-red-600">삭제</button>
        </div>
      ))}
    </div>
  );
}

type L = { id: string; email: string; action: string; title: string; at?: { toDate: () => Date } };
const ACT: Record<string, string> = { view: "열람", download: "다운로드", upload: "업로드", delete: "삭제" };
function Logs() {
  const [logs, setLogs] = useState<L[]>([]);
  useEffect(() => {
    getDocs(query(collection(db, "logs"), orderBy("at", "desc"), limit(300)))
      .then((s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() }) as L)));
  }, []);
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-left"><tr><th className="p-2">시각</th><th className="p-2">사용자</th><th className="p-2">동작</th><th className="p-2">자료</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="whitespace-nowrap p-2 text-gray-500">{l.at?.toDate().toLocaleString("ko-KR") ?? "-"}</td>
              <td className="p-2">{l.email}</td>
              <td className="p-2">{ACT[l.action] ?? l.action}</td>
              <td className="p-2">{l.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-2 text-xs text-gray-400">최근 300건 표시</p>
    </div>
  );
}
