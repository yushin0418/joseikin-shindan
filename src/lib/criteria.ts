import fs from "node:fs";
import path from "node:path";
import type { DeadlineDef } from "./deadline";

/** config/criteria.json の型定義 */
export interface Criteria {
  version: string;
  disclaimer: string;
  updatedAt: string;
  gyomukaizen: {
    label: string;
    fiscalYear: string;
    source: string;
    minRaiseYen: number;
    /** 助成対象経費の下限（税抜） */
    minEligibleCostYen: number;
    rate: { boundaryYen: number; below: number; atOrAbove: number };
    smallEmployerMaxEmployees: number;
    smeMaxRegularEmployeesByCategory: Record<string, number>;
    smeMaxCapitalByCategory: Record<string, number>;
    courses: Record<
      string,
      {
        label: string;
        minRaise: number;
        caps: { maxHc: number; normal: number; small: number }[];
        /** 「10人以上」の上限額区分。特例事業者（事業場内最賃1,050円未満 等）が10人以上を引き上げる場合のみ */
        tenPlus: number;
      }
    >;
    requiredDocs: string[];
  };
  hatarakikata: {
    label: string;
    course: string;
    fiscalYear: string;
    source: string;
    subsidyRate: number;
    subsidyRateSmall: number;
    goal1CapsByType: Record<string, number>;
    /** 交付額の端数切捨て単位（交付要綱第6条：1,000円未満切捨て） */
    roundingYen: number;
    goal2Cap: number;
    goal3Cap: number;
    requiredDocs: string[];
  };
  careerUp: {
    label: string;
    fiscalYear: string;
    source: string;
    minWageIncreaseRate: number;
    annualApplicantCap: number;
    amounts: Record<string, Record<string, { 重点支援: number; 上記以外: number }>>;
    additions: Record<string, { 中小企業: number; 大企業: number }>;
    requiredDocs: string[];
  };
  /** 期限の注意喚起を始める残り日数 */
  deadlineWarnDays?: number;
  /** 助成金ごとの期限（日付は ISO 形式 YYYY-MM-DD）。法改正・年度更新はこの設定だけ直せばよい */
  deadlines?: Record<string, DeadlineDef[]>;
  commonRisks: string[];
}

let cached: Criteria | null = null;

/**
 * 判定条件をファイルから読み込む。法改正時は config/criteria.json を編集するだけで反映される。
 * （プロセス内キャッシュ。変更を即時反映したい場合は reloadCriteria() を呼ぶ）
 */
export function getCriteria(): Criteria {
  if (cached) return cached;
  const file = path.join(process.cwd(), "config", "criteria.json");
  const raw = fs.readFileSync(file, "utf-8");
  cached = JSON.parse(raw) as Criteria;
  return cached;
}

export function reloadCriteria(): Criteria {
  cached = null;
  return getCriteria();
}
