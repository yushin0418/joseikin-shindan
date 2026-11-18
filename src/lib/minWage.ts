import fs from "node:fs";
import path from "node:path";

/** config/regional-min-wage.json（厚生労働省「令和8年度 地域別最低賃金 答申状況」）の型 */
export interface PrefectureMinWage {
  /** 令和8年度の地域別最低賃金（答申額・円） */
  r8: number;
  /** 改定前（令和7年度）の地域別最低賃金（円） */
  r7: number;
  /** 令和8年度の発効予定日（ISO 日付）。異議申出の状況で変更される場合がある */
  effective: string;
}

interface MinWageFile {
  fiscalYear: string;
  source: string;
  note: string;
  closedDays: string[];
  prefectures: Record<string, PrefectureMinWage>;
}

let cached: MinWageFile | null = null;

function load(): MinWageFile {
  if (cached) return cached;
  const file = path.join(process.cwd(), "config", "regional-min-wage.json");
  cached = JSON.parse(fs.readFileSync(file, "utf-8")) as MinWageFile;
  return cached;
}

/** 都道府県名の一覧（フォームの選択肢。表の順＝北から南） */
export function listPrefectures(): string[] {
  return Object.keys(load().prefectures);
}

/** 都道府県の最低賃金データ。未選択・未知の名前は null */
export function getPrefectureMinWage(prefecture: string | null | undefined): PrefectureMinWage | null {
  if (!prefecture) return null;
  return load().prefectures[prefecture] ?? null;
}

export function getMinWageMeta(): { fiscalYear: string; source: string; note: string } {
  const f = load();
  return { fiscalYear: f.fiscalYear, source: f.source, note: f.note };
}

/** 行政機関の休日（祝日等）の ISO 日付集合 */
export function getClosedDays(): Set<string> {
  return new Set(load().closedDays);
}

/** 全都道府県のデータ（画面の自動入力用） */
export function allPrefectureMinWages(): Record<string, PrefectureMinWage> {
  return load().prefectures;
}
