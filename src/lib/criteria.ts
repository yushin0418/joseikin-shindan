import fs from "node:fs";
import path from "node:path";

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
    rate: { boundaryYen: number; below: number; atOrAbove: number };
    smallEmployerMaxEmployees: number;
    smeMaxRegularEmployeesByCategory: Record<string, number>;
    courses: Record<
      string,
      { label: string; minRaise: number; caps: { maxHc: number; normal: number; small: number }[] }
    >;
    requiredDocs: string[];
  };
  hatarakikata: {
    label: string;
    require36Agreement: boolean;
    requireWorktimeImprovement: boolean;
    requireEquipmentInvestment: boolean;
    requiredDocs: string[];
  };
  careerUp: {
    label: string;
    minWageIncreaseRate: number;
    requireFixedTermEmployee: boolean;
    requireConversionPlan: boolean;
    requireRulesRevision: boolean;
    requiredDocs: string[];
  };
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
