"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, provider } from "./firebase";

type Role = "admin" | "viewer" | null;
type Ctx = { user: User | null; email: string; role: Role; loading: boolean; signIn: () => Promise<void>; signOut: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setLoading(true);
    setUser(u);
    let r: Role = null;
    if (u?.email) {
      try {
        const s = await getDoc(doc(db, "allowedUsers", u.email.toLowerCase()));
        if (s.exists()) r = s.data().role === "admin" ? "admin" : "viewer";
      } catch { r = null; }
    }
    setRole(r);
    setLoading(false);
  }), []);

  const value: Ctx = {
    user, role, loading, email: user?.email?.toLowerCase() ?? "",
    signIn: async () => { await signInWithPopup(auth, provider); },
    signOut: async () => { await fbSignOut(auth); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
