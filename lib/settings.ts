"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { CATEGORIES, ROUNDS } from "./types";

export type Cats = { rounds: string[]; categories: string[] };
const DEFAULT: Cats = { rounds: ROUNDS, categories: CATEGORIES };
let cache: Cats | null = null;
const subs = new Set<(c: Cats) => void>();

export async function loadCats(): Promise<Cats> {
  if (cache) return cache;
  try {
    const s = await getDoc(doc(db, "settings", "categories"));
    const d = s.exists() ? (s.data() as Partial<Cats>) : {};
    cache = { rounds: d.rounds?.length ? d.rounds : DEFAULT.rounds, categories: d.categories?.length ? d.categories : DEFAULT.categories };
  } catch { cache = DEFAULT; }
  return cache;
}
export async function saveCats(c: Cats) {
  await setDoc(doc(db, "settings", "categories"), c);
  cache = c; subs.forEach((f) => f(c));
}
export function useCats() {
  const [c, setC] = useState<Cats>(cache ?? DEFAULT);
  useEffect(() => { loadCats().then(setC); subs.add(setC); return () => { subs.delete(setC); }; }, []);
  return c;
}
