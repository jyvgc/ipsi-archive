export type Cell = string | number | null;
export type SheetData = { name: string; title?: string; columns: string[]; rows: Cell[][]; refined?: boolean };
export type FileData = { sheets: SheetData[] };
export type FileMeta = {
  id: string; year: number; round: string; category: string; title: string;
  fileName: string; sheetNames: string[]; rowCount: number;
  originalPath: string; dataPath: string; uploadedBy: string; createdAt?: { seconds: number } | null;
};
export const ROUNDS = ["수시1차", "수시2차", "정시", "추가모집", "기타"];
export const CATEGORIES = ["학과별 지원", "학과별 등록", "고교별 지원", "지역별 현황", "경쟁률", "충원·등록률", "지원자 명부", "기타"];
