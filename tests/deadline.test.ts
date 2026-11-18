import { describe, it, expect } from "vitest";
import { runDiagnosis } from "@/lib/diagnosis";
import { daysUntil, deadlineInfo, formatReiwa, jstDate } from "@/lib/deadline";
import type { DiagnosisInput } from "@/lib/validation";

// 全要件を満たす基本ケース（期限以外の理由で×にならないもの）
const base: DiagnosisInput = {
  companyName: "期限テスト",
  corporateNumber: "",
  address: "東京都",
  industry: "建設業",
  industryCategory: "その他",
  orgType: "法人",
  capitalYen: 10000000,
  contactName: "",
  contactTel: "",
  contactEmail: "",
  hasBranch: false,
  branchNote: "",
  employeeCount: 8,
  regularStaffCount: 3,
  permanentInsuredCount: 0,
  fixedTermInsuredCount: 3,
  under20hUninsuredCount: 1,
  under20hFixedTermCount: 0,
  inHouseMinWage: 1040,
  regionalMinWage: 1226,
  hasLaborInsurance: true,
  hasEmploymentIns: true,
  hasSocialInsurance: true,
  agreement36Status: "届出済み",
  agreement36Date: "",
  workRulesStatus: "届出済み",
  hasWageLedger: true,
  hasAttendanceBook: true,
  hasEmployeeRoster: true,
  employmentContractsStatus: "はい",
  employmentContractsNote: "",
  workDays: "",
  holidays: "",
  vacations: "",
  workHours: "",
  breakTime: "",
  allowance1Name: "",
  allowance1Amount: "",
  allowance2Name: "",
  allowance2Amount: "",
  allowance3Name: "",
  allowance3Amount: "",
  payClosingDay: "",
  payDay: "",
  hasRaiseSystem: true,
  raiseMonth: "",
  plannedWageRaise: 90,
  wageRaiseHeadcount: 8,
  retirementSystem: "",
  hasBonus: true, // 正社員化コースは「賞与または退職金」かつ「昇給」が要件
  bonusSummer: "6月",
  bonusWinter: "12月",
  hasRetirementAllowance: false,
  willInvestEquipment: true,
  equipmentName: "設備",
  equipmentPrice: 6000000,
  equipmentVendor: "",
  equipmentPurpose: "",
  productivityEffect: "",
  plannedConversions: 3,
  prioritySupportConversions: 2,
  conversionDate: "",
  pastSubsidies: "",
  sharoshiContract: "なし",
  companyReasonLeavers: 0,
  over60Insured: 0,
  over50FixedTerm: 0,
  noFraudPast3y: true,
  noLaborLawViolation: true,
  canPrepareCareerPlan: true,
  canReviseWorkRules: true,
};

const at = (iso: string) => new Date(iso);
const grant = (r: ReturnType<typeof runDiagnosis>, key: string) => r.grants.find((g) => g.key === key)!;

describe("日付・期限の計算", () => {
  it("令和表記", () => {
    expect(formatReiwa("2026-11-30")).toBe("令和8年11月30日");
    expect(formatReiwa("2019-05-01")).toBe("令和元年5月1日");
  });

  it("残り日数は日本時間の暦日で数える", () => {
    expect(daysUntil("2026-11-30", at("2026-11-18T12:00:00+09:00"))).toBe(12);
    expect(daysUntil("2026-11-30", at("2026-11-30T23:59:59+09:00"))).toBe(0);
    expect(daysUntil("2026-11-30", at("2026-12-01T00:00:00+09:00"))).toBe(-1);
  });

  it("UTC のサーバーでも日本時間の日付になる（UTC 15:00 = 日本時間の翌0:00）", () => {
    expect(jstDate(at("2026-11-30T14:59:59Z"))).toBe("2026-11-30");
    expect(jstDate(at("2026-11-30T15:00:00Z"))).toBe("2026-12-01");
  });

  it("状態：遠い=ok／14日以内=soon／当日=today／超過=passed", () => {
    const def = { label: "交付申請期限", date: "2026-11-30" };
    expect(deadlineInfo(def, at("2026-10-01T00:00:00+09:00")).state).toBe("ok");
    expect(deadlineInfo(def, at("2026-11-16T00:00:00+09:00")).state).toBe("soon"); // 14日前
    expect(deadlineInfo(def, at("2026-11-15T00:00:00+09:00")).state).toBe("ok"); // 15日前
    expect(deadlineInfo(def, at("2026-11-30T10:00:00+09:00")).state).toBe("today");
    expect(deadlineInfo(def, at("2026-12-01T00:00:00+09:00")).state).toBe("passed");
  });

  it("文言：あと◯日／過ぎています", () => {
    const def = { label: "交付申請期限", date: "2026-11-30" };
    expect(deadlineInfo(def, at("2026-11-18T12:00:00+09:00")).text).toContain("あと12日");
    expect(deadlineInfo(def, at("2026-12-03T12:00:00+09:00")).text).toContain("過ぎています（3日超過）");
  });
});

describe("期限ルールの適用（診断結果）", () => {
  it("期限が遠いうちは判定を変えず、期限情報だけ付く", () => {
    const r = runDiagnosis(base, undefined, at("2026-10-01T00:00:00+09:00"));
    expect(grant(r, "gyomukaizen").status).toBe("○");
    expect(grant(r, "hatarakikata").status).toBe("○");
    expect(grant(r, "hatarakikata").deadlines?.length).toBeGreaterThan(0);
    expect(grant(r, "hatarakikata").risks.some((x) => x.includes("あと"))).toBe(false);
  });

  it("期限が近い：判定は○のまま、リスクとアクションに「あと◯日」を足す", () => {
    const r = runDiagnosis(base, undefined, at("2026-11-18T12:00:00+09:00"));
    for (const key of ["gyomukaizen", "hatarakikata"]) {
      const g = grant(r, key);
      expect(g.status).toBe("○");
      expect(g.risks[0]).toContain("あと12日");
      expect(g.actions[0]).toContain("申請期限が迫っています");
    }
  });

  it("期限当日：本日が期限", () => {
    const r = runDiagnosis(base, undefined, at("2026-11-30T09:00:00+09:00"));
    expect(grant(r, "hatarakikata").risks[0]).toContain("本日が期限");
    expect(grant(r, "hatarakikata").status).toBe("○");
  });

  it("期限を過ぎたら×（今年度の受付終了の可能性）に落とす", () => {
    const r = runDiagnosis(base, undefined, at("2026-12-01T00:00:00+09:00"));
    for (const key of ["gyomukaizen", "hatarakikata"]) {
      const g = grant(r, key);
      expect(g.status).toBe("×");
      expect(g.shortfalls[0]).toContain("過ぎています");
      expect(g.actions[0]).toContain("次年度");
    }
  });

  it("期限の無いキャリアアップは期限超過の影響を受けない", () => {
    const r = runDiagnosis(base, undefined, at("2027-03-01T00:00:00+09:00"));
    expect(grant(r, "careerUp").status).toBe("○");
    expect(grant(r, "careerUp").deadlines).toBeUndefined();
  });

  it("全助成金が×になれば総合Cになる（期限超過）", () => {
    // キャリアアップも×になるよう有期労働者なしにする
    const r = runDiagnosis(
      { ...base, fixedTermInsuredCount: 0, under20hFixedTermCount: 0 },
      undefined,
      at("2026-12-01T00:00:00+09:00"),
    );
    expect(r.overallRank).toBe("C");
  });
});
