import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type LogAction = "view" | "download" | "upload" | "delete";
export function writeLog(email: string, action: LogAction, f: { id: string; title: string }) {
  addDoc(collection(db, "logs"), {
    email, action, fileId: f.id, title: f.title, at: serverTimestamp(),
    ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 150) : "",
  }).catch(() => {});
}
