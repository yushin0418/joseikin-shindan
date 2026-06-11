import { describe, it, expect } from "vitest";
import { runDiagnosis } from "@/lib/diagnosis";
import { getCriteria } from "@/lib/criteria";
import type { DiagnosisInput } from "@/lib/validation";

// 記入例（申請ひな形株式会社）相当の全要件充足ケース
const base: DiagnosisInput = {
  companyName: "申請ひな形株式会社",
  corporateNumber: "1000001012345",
  address: "東京都豊島区",
  industry: "建設業",
  industryCategory: "その他",
  orgType: "法人",
  contactName: "山田 花子",
  contactTel: "03-5954-0000",
  contactEmail: "hanako@example.com",
  hasBranch: false,
  branchNote: "",
  employeeCount: 7,
  regularStaffCount: 3,
  permanentInsuredCount: 0,
  fixedTermInsuredCount: 3,
  under20hUninsuredCount: 1,
  under20hFixedTermCount: 0,
  inHouseMinWage: 1226,
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
  payClosingDay: "月末",
  payDay: "翌月10日",
  hasRaiseSystem: true,
  raiseMonth: "10月",
  plannedWageRaise: 50,
  wageRaiseHeadcount: 1,
  retirementSystem: "",
  hasBonus: true,
  bonusSummer: "6月",
  bonusWinter: "12月",
  hasRetirementAllowance: false,
  willInvestEquipment: true,
  equipmentName: "ミニタイヤショベル",
  equipmentPrice: 2000000,
  equipmentVendor: "池袋機械販売",
  equipmentPurpose: "作業効率の向上",
  productivityEffect: "作業時間短縮",
  plannedConversions: 1,
  conversionDate: "",
  pastSubsidies: "",
  sharoshiContract: "なし",
  companyReasonLeavers: 0,
  over60Insured: 0,
  over50FixedTerm: 0,
  noFraudPast3y: true,
  noLaborLawViolation: true,
  willImproveWorktime: true,
  canPrepareCareerPlan: true,
  canReviseWorkRules: true,
};

function get(key: string, r = runDiagnosis(base)) {
  return r.grants.find((g) => g.key === key)!;
}

describe("総合判定", () => {
  it("全要件を満たす場合、3助成金とも○で総合Aランク", () => {
    const r = runDiagnosis(base);
    expect(get("gyomukaizen", r).status).toBe("○");
    expect(get("hatarakikata", r).status).toBe("○");
    expect(get("careerUp", r).status).toBe("○");
    expect(r.overallRank).toBe("A");
    expect(r.eligibleCount).toBe(3);
  });
});

describe("業務改善助成金", () => {
  it("賃上げ予定も設備投資も無ければ×", () => {
    const r = runDiagnosis({
      ...base,
      plannedWageRaise: 0,
      wageRaiseHeadcount: 0,
      willInvestEquipment: false,
      equipmentName: "",
      equipmentPrice: 0,
    });
    expect(get("gyomukaizen", r).status).toBe("×");
  });

  it("中小企業規模を超過すると○にはならない（従業員数で判定）", () => {
    const r = runDiagnosis({ ...base, industryCategory: "小売業", employeeCount: 80 });
    expect(get("gyomukaizen", r).status).not.toBe("○");
  });
});

describe("働き方改革推進支援助成金", () => {
  it("36協定が未作成なら×", () => {
    const r = runDiagnosis({ ...base, agreement36Status: "未作成" });
    expect(get("hatarakikata", r).status).toBe("×");
  });

  it("36協定が作成済み未届でも前提未充足で×", () => {
    const r = runDiagnosis({ ...base, agreement36Status: "作成済み未届" });
    expect(get("hatarakikata", r).status).toBe("×");
  });

  it("労働時間改善の取組予定が無ければ△", () => {
    const r = runDiagnosis({ ...base, willImproveWorktime: false });
    expect(get("hatarakikata", r).status).toBe("△");
  });
});

describe("キャリアアップ助成金（正社員化）", () => {
  it("有期労働者が居なければ×", () => {
    const r = runDiagnosis({ ...base, fixedTermInsuredCount: 0, under20hFixedTermCount: 0 });
    expect(get("careerUp", r).status).toBe("×");
  });

  it("転換予定が無ければ△", () => {
    const r = runDiagnosis({ ...base, plannedConversions: 0 });
    expect(get("careerUp", r).status).toBe("△");
  });
});

describe("不支給リスク（コンプライアンス）", () => {
  it("不正受給ありは全助成金のリスクに表示される", () => {
    const r = runDiagnosis({ ...base, noFraudPast3y: false });
    for (const g of r.grants) {
      expect(g.risks.some((x) => x.includes("不正受給"))).toBe(true);
    }
  });

  it("会社都合離職者がいるとリスクに人数付きで表示される", () => {
    const r = runDiagnosis({ ...base, companyReasonLeavers: 2 });
    expect(get("careerUp", r).risks.some((x) => x.includes("会社都合離職者が2名"))).toBe(true);
  });
});

describe("設定ファイル駆動（法改正対応）", () => {
  it("中小企業の規模上限を変更すると業務改善助成金の判定が変わる", () => {
    const input: DiagnosisInput = { ...base, industryCategory: "小売業", employeeCount: 80 };
    const c = getCriteria();

    const strict = runDiagnosis(input, {
      ...c,
      gyomukaizen: {
        ...c.gyomukaizen,
        smeMaxRegularEmployeesByCategory: { ...c.gyomukaizen.smeMaxRegularEmployeesByCategory, 小売業: 50 },
      },
    });
    expect(get("gyomukaizen", strict).status).not.toBe("○");

    const relaxed = runDiagnosis(input, {
      ...c,
      gyomukaizen: {
        ...c.gyomukaizen,
        smeMaxRegularEmployeesByCategory: { ...c.gyomukaizen.smeMaxRegularEmployeesByCategory, 小売業: 100 },
      },
    });
    expect(get("gyomukaizen", relaxed).status).toBe("○");
  });
});
