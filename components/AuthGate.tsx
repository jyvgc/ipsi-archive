"use client";
import { useAuth } from "@/lib/auth";

export default function AuthGate({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, role, loading, signIn, signOut, email } = useAuth();

  if (loading) return <Center><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" /></Center>;

  if (!user) return (
    <Center>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="mb-2 text-3xl">📂</div>
        <h1 className="text-2xl font-bold text-brand">입학 자료실</h1>
        <p className="mt-2 text-sm text-gray-500">입학처 내부 전용입니다.<br />등록된 구글 계정으로 로그인하세요.</p>
        <button onClick={() => signIn().catch((e) => alert("로그인 실패: " + e.message))}
          className="mt-6 w-full rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-dark">Google 계정으로 로그인</button>
      </div>
    </Center>
  );

  if (!role || (adminOnly && role !== "admin")) return (
    <Center>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="mb-2 text-3xl">🔒</div>
        <h1 className="text-xl font-bold">접근 권한이 없습니다</h1>
        <p className="mt-2 break-all text-sm text-gray-500">{email}</p>
        <p className="mt-1 text-sm text-gray-500">{adminOnly ? "관리자만 이용할 수 있습니다." : "관리자에게 이메일 등록을 요청하세요."}</p>
        <div className="mt-6 flex gap-2">
          {adminOnly && <a href="/" className="flex-1 rounded-xl border py-3 font-semibold">자료실로</a>}
          <button onClick={signOut} className="flex-1 rounded-xl bg-gray-800 py-3 font-semibold text-white">로그아웃</button>
        </div>
      </div>
    </Center>
  );
  return <>{children}</>;
}
const Center = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen items-center justify-center p-4">{children}</div>;
