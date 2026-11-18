/**
 * 申請期限の計算（サーバー・画面・PDF で共通）。
 *
 * - 期限は config/criteria.json の deadlines に ISO 日付(YYYY-MM-DD)で持つ。
 * - 「あと◯日」は保存せず、表示のたびに計算する（診断結果は保存したものを後から開くため）。
 * - 日数は日本時間(JST)の暦日で数える。期限日の 23:59 までは有効（当日は「本日が期限」）。
 */

export interface DeadlineDef {
  key: string;
  label: string;
  /** ISO 日付 YYYY-MM-DD */
  date: string;
  /** true の期限は「過ぎたら申請不可」として判定(○/△)に影響させる */
  blocksApplication?: boolean;
  note?: string;
}

export type DeadlineState = "ok" | "soon" | "today" | "passed";

export interface DeadlineInfo {
  state: DeadlineState;
  /** 期限日までの残り日数（当日=0、超過は負） */
  daysLeft: number;
  /** 例：令和8年11月30日 */
  dateText: string;
  /** 例：交付申請期限 令和8年11月30日まで あと12日 */
  text: string;
}

export const DEFAULT_WARN_DAYS = 14;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 現在時刻を日本時間の暦日 YYYY-MM-DD にする */
export function jstDate(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** 期限日までの残り日数（日本時間の暦日ベース）。当日は 0、過ぎていれば負 */
export function daysUntil(dateIso: string, now: Date): number {
  return dayNumber(dateIso) - dayNumber(jstDate(now));
}

/** ISO 日付に日数を足す（UTC の暦日計算。夏時間の影響を受けない） */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 土日または指定の休日か（行政機関の閉庁日） */
export function isClosedDay(iso: string, closedDays: Set<string>): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=日, 6=土
  return dow === 0 || dow === 6 || closedDays.has(iso);
}

/** 末日が閉庁日なら前開庁日に繰り上げる（業務改善助成金Q&A問50：行政機関の休日の場合はその前開庁日） */
export function prevBusinessDay(iso: string, closedDays: Set<string>): string {
  let cur = iso;
  while (isClosedDay(cur, closedDays)) cur = addDays(cur, -1);
  return cur;
}

/** 2つの ISO 日付のうち早い方 */
export function earlierDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/** 2026-11-30 → 令和8年11月30日（令和元年=2019 のみ「元」） */
export function formatReiwa(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const r = y - 2018;
  return `令和${r === 1 ? "元" : r}年${m}月${d}日`;
}

export function deadlineInfo(
  def: Pick<DeadlineDef, "label" | "date">,
  now: Date,
  warnDays: number = DEFAULT_WARN_DAYS,
): DeadlineInfo {
  const daysLeft = daysUntil(def.date, now);
  const dateText = formatReiwa(def.date);
  if (daysLeft < 0) {
    return {
      state: "passed",
      daysLeft,
      dateText,
      text: `${def.label} ${dateText}を過ぎています（${-daysLeft}日超過）`,
    };
  }
  if (daysLeft === 0) {
    return { state: "today", daysLeft, dateText, text: `${def.label} ${dateText} 本日が期限です` };
  }
  if (daysLeft <= warnDays) {
    return { state: "soon", daysLeft, dateText, text: `${def.label} ${dateText}まで あと${daysLeft}日` };
  }
  return { state: "ok", daysLeft, dateText, text: `${def.label} ${dateText}まで（あと${daysLeft}日）` };
}
