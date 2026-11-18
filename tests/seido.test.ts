import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { runDiagnosis } from "@/lib/diagnosis";
import { getCriteria } from "@/lib/criteria";
import type { DiagnosisInput } from "@/lib/validation";

/**
 * 制度（令和8年度の交付要綱・要領・パンフレット・Q&A）との整合を確認するテスト。
 * 各テストの根拠は、お預かりした資料（助成金要領など）の本文。期限の影響を避けるため日付を固定する。
 */
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T00:00:00+09:00"));
});
afterAll(() => {
  vi.useRealTimers();
});

const base: DiagnosisInput = {
  companyName: "制度テスト",
  corporateNumber: "",
  address: "東京都",
  industry: "建設業",
  industryCategory: "その他",
  orgType: "法人",
  capitalYen: 10000000,
  prefecture: "熊本県", // 令和8年度 1,092円（改定前 1,034円）・発効予定 2026-12-01 → 申請期間の末日は 2026-11-30
  establishmentEmployeeCount: 0,
  deemedLargeEnterprise: false,
  priceSurgeRequirement: false,
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
  hasBonus: true,
  bonusSummer: "",
  bonusWinter: "",
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

const grant = (r: ReturnType<typeof runDiagnosis>, key: string) => r.grants.find((g) => g.key === key)!;
const run = (over: Partial<DiagnosisInput> = {}) => runDiagnosis({ ...base, ...over });

describe("業務改善助成金（令和8年度のご案内・Q&A・改正のお知らせ）", () => {
  it("上限額表：案内の計算例（8人・90円・最賃1,040円・設備600万円）で450万円", () => {
    expect(grant(run(), "gyomukaizen").estimatedAmount).toContain("4,500,000");
  });

  it("「10人以上」の上限区分は特例事業者（事業場内最賃1,050円未満）のみ：90円コース10人で600万円", () => {
    const g = grant(run({ wageRaiseHeadcount: 10, employeeCount: 12, equipmentPrice: 9000000 }), "gyomukaizen");
    expect(g.estimatedAmount).toContain("6,000,000");
    expect(g.estimatedAmount).toContain("10人以上区分");
  });

  it("事業場内最賃が1,050円以上なら10人以上区分は使えず、「8人以上」の450万円で算定＋要確認を出す", () => {
    const g = grant(
      run({ wageRaiseHeadcount: 10, employeeCount: 12, inHouseMinWage: 1100, equipmentPrice: 9000000 }),
      "gyomukaizen",
    );
    expect(g.estimatedAmount).toContain("4,500,000");
    expect(g.estimatedAmount).not.toContain("10人以上区分");
    expect(g.shortfalls.some((s) => s.includes("特例事業者"))).toBe(true);
  });

  it("10人以上区分：50円コース130万円・70円コース300万円", () => {
    const c50 = grant(
      run({ wageRaiseHeadcount: 10, employeeCount: 12, plannedWageRaise: 50, equipmentPrice: 9000000 }),
      "gyomukaizen",
    );
    expect(c50.estimatedAmount).toContain("1,300,000");
    const c70 = grant(
      run({ wageRaiseHeadcount: 10, employeeCount: 12, plannedWageRaise: 70, equipmentPrice: 9000000 }),
      "gyomukaizen",
    );
    expect(c70.estimatedAmount).toContain("3,000,000");
  });

  it("労働保険（労災・雇用保険）に未加入だと対象にならない（Q&A問4）", () => {
    for (const over of [{ hasLaborInsurance: false }, { hasEmploymentIns: false }]) {
      const g = grant(run(over), "gyomukaizen");
      expect(g.status).not.toBe("○");
      expect(g.shortfalls.some((s) => s.includes("労働保険"))).toBe(true);
    }
  });

  it("助成対象経費の下限は税抜10万円（Q&A問25）", () => {
    const g = grant(run({ equipmentPrice: 95000 }), "gyomukaizen");
    expect(g.status).not.toBe("○");
    expect(g.shortfalls.some((s) => s.includes("下限"))).toBe(true);
    expect(grant(run({ equipmentPrice: 100000 }), "gyomukaizen").status).toBe("○");
  });

  it("賃金引上げは申請より後・PC等は原則対象外などのリスクを出す", () => {
    const risks = grant(run(), "gyomukaizen").risks.join("\n");
    expect(risks).toContain("申請より後");
    expect(risks).toContain("パソコン");
    expect(risks).toContain("税抜");
  });
});

describe("業務改善助成金：都道府県ごとの申請期間・地域別最低賃金（交付要領・Q&A・令和8年度答申状況）", () => {
  const at = (iso: string) => new Date(iso);
  const gy = (over: Partial<DiagnosisInput>, now: string) =>
    grant(runDiagnosis({ ...base, ...over }, undefined, at(now)), "gyomukaizen");

  it("申請期間の末日＝「発効日の前日」と「11/30」の早い方：東京(10/1発効)は9/30、熊本(12/1)は11/30", async () => {
    const { gyomukaizenApplyEnd } = await import("@/lib/diagnosis");
    expect(gyomukaizenApplyEnd("東京都", "2026-11-30")).toBe("2026-09-30");
    expect(gyomukaizenApplyEnd("兵庫県", "2026-11-30")).toBe("2026-09-30");
    expect(gyomukaizenApplyEnd("熊本県", "2026-11-30")).toBe("2026-11-30");
    expect(gyomukaizenApplyEnd("沖縄県", "2026-11-30")).toBe("2026-11-30"); // 12/2発効でも11/30が早い
    expect(gyomukaizenApplyEnd("", "2026-11-30")).toBeNull();
  });

  it("末日が土日なら前開庁日に繰り上げる（Q&A問50）", async () => {
    const { gyomukaizenApplyEnd } = await import("@/lib/diagnosis");
    // 福井・奈良：10/4(日)発効 → 前日10/3(土) → 前開庁日 10/2(金)
    expect(gyomukaizenApplyEnd("福井県", "2026-11-30")).toBe("2026-10-02");
    expect(gyomukaizenApplyEnd("奈良県", "2026-11-30")).toBe("2026-10-02");
    // 広島：10/11(日)発効 → 前日10/10(土) → 前開庁日 10/9(金)
    expect(gyomukaizenApplyEnd("広島県", "2026-11-30")).toBe("2026-10-09");
    // 石川：10/3(土)発効 → 前日10/2(金)で繰り上げ不要
    expect(gyomukaizenApplyEnd("石川県", "2026-11-30")).toBe("2026-10-02");
    // 島根：10/10(土)発効 → 前日10/9(金)で繰り上げ不要
    expect(gyomukaizenApplyEnd("島根県", "2026-11-30")).toBe("2026-10-09");
  });

  it("末日が祝日のときも前開庁日に繰り上げる：祝日(10/12スポーツの日)を設定から読む", async () => {
    const { prevBusinessDay } = await import("@/lib/deadline");
    const { getClosedDays } = await import("@/lib/minWage");
    // 10/12(月・祝) → 前開庁日は 10/9(金)（10/10土・10/11日は閉庁）
    expect(prevBusinessDay("2026-10-12", getClosedDays())).toBe("2026-10-09");
  });

  it("東京都は令和8年11月18日時点で申請期間が終了＝×（10/1発効のため9/30が末日）", () => {
    const g = gy({ prefecture: "東京都", inHouseMinWage: 1226 }, "2026-11-18T12:00:00+09:00");
    expect(g.status).toBe("×");
    expect(g.shortfalls.some((s) => s.includes("過ぎています"))).toBe(true);
  });

  it("熊本県は令和8年11月18日時点でまだ申請できる＝期限は11/30で「あと12日」", () => {
    const g = gy({}, "2026-11-18T12:00:00+09:00");
    expect(g.status).toBe("○");
    expect(g.risks[0]).toContain("あと12日");
    const apply = g.deadlines?.find((d) => d.key === "apply");
    expect(apply?.date).toBe("2026-11-30");
    expect(g.deadlines?.some((d) => d.key === "raise" && d.date === "2026-11-30")).toBe(true);
  });

  it("本日時点で申請期間が残っているのは岩手・熊本・沖縄の3県（令和8年11月18日）", async () => {
    const { gyomukaizenOpenPrefectures } = await import("@/lib/diagnosis");
    const open = gyomukaizenOpenPrefectures(at("2026-11-18T12:00:00+09:00"), "2026-11-30");
    expect(open.sort()).toEqual(["岩手県", "沖縄県", "熊本県"].sort());
  });

  it("都道府県が未入力なら○にならず、都道府県の入力を求める", () => {
    const g = gy({ prefecture: "" }, "2026-10-01T00:00:00+09:00");
    expect(g.status).not.toBe("○");
    expect(g.shortfalls.some((s) => s.includes("都道府県が未入力"))).toBe(true);
  });

  it("対象事業場：令和8年度の地域別最賃（熊本1,092円）以上は対象外（Q&A問3）／改定前の額（1,034円）を下回るのも対象外（Q&A問6）", () => {
    expect(gy({ inHouseMinWage: 1092 }, "2026-10-01T00:00:00+09:00").status).not.toBe("○");
    const below = gy({ inHouseMinWage: 1030 }, "2026-10-01T00:00:00+09:00");
    expect(below.status).not.toBe("○");
    expect(below.shortfalls.some((s) => s.includes("申請時点で適用されている地域別最低賃金"))).toBe(true);
    expect(gy({ inHouseMinWage: 1034 }, "2026-10-01T00:00:00+09:00").status).toBe("○"); // ちょうど改定前の額は可
  });

  it("みなし大企業は対象外（交付要綱第2条第2項）", () => {
    const g = gy({ deemedLargeEnterprise: true }, "2026-10-01T00:00:00+09:00");
    expect(g.status).not.toBe("○");
    expect(g.shortfalls.some((s) => s.includes("みなし大企業"))).toBe(true);
  });

  it("特例事業者：物価高騰等要件に該当すれば、事業場内最賃が1,050円以上でも「10人以上」の上限区分（600万円）が使える（別紙2・別表第2）", () => {
    const over = { inHouseMinWage: 1060, wageRaiseHeadcount: 10, employeeCount: 12, equipmentPrice: 9000000 };
    // 熊本の令和8年度は1,092円なので、1,060円は対象範囲内（改定前1,034円以上・1,092円未満）
    const on = gy({ ...over, priceSurgeRequirement: true }, "2026-10-01T00:00:00+09:00");
    expect(on.estimatedAmount).toContain("6,000,000");
    expect(on.estimatedAmount).toContain("10人以上区分");
    const off = gy({ ...over, priceSurgeRequirement: false }, "2026-10-01T00:00:00+09:00");
    expect(off.estimatedAmount).not.toContain("10人以上区分");
  });

  it("「事業場規模30人未満」は申請事業場の人数で判定する（会社全体が50人でも、事業場が20人なら（）内の上限）", () => {
    // 90円コース・2〜3人：通常150万円／事業場規模30人未満は240万円
    const small = gy({ employeeCount: 50, establishmentEmployeeCount: 20, wageRaiseHeadcount: 3, equipmentPrice: 6000000 }, "2026-10-01T00:00:00+09:00");
    expect(small.estimatedAmount).toContain("2,400,000");
    const large = gy({ employeeCount: 50, establishmentEmployeeCount: 40, wageRaiseHeadcount: 3, equipmentPrice: 6000000 }, "2026-10-01T00:00:00+09:00");
    expect(large.estimatedAmount).toContain("1,500,000");
  });

  it("交付額は1,000円未満切捨て（交付要綱第4条第2項）：設備1,234,567円×4/5 → 987,000円", () => {
    const g = gy({ wageRaiseHeadcount: 8, equipmentPrice: 1234567 }, "2026-10-01T00:00:00+09:00");
    expect(g.estimatedAmount).toContain("987,000");
  });
});

describe("キャリアアップ助成金・正社員化コース（パンフレット・Q&A）", () => {
  it("転換先の正社員に「賞与または退職金」と「昇給」が必要：どちらも無ければ○にならない（Q-1）", () => {
    const noBonus = grant(run({ hasBonus: false, hasRetirementAllowance: false }), "careerUp");
    expect(noBonus.status).toBe("△");
    expect(noBonus.shortfalls.some((s) => s.includes("賞与または退職金"))).toBe(true);

    const noRaise = grant(run({ hasRaiseSystem: false }), "careerUp");
    expect(noRaise.status).toBe("△");
    expect(noRaise.shortfalls.some((s) => s.includes("昇給"))).toBe(true);
  });

  it("賞与か退職金のどちらか一方があり、昇給があれば○", () => {
    expect(grant(run({ hasBonus: true, hasRetirementAllowance: false }), "careerUp").status).toBe("○");
    expect(grant(run({ hasBonus: false, hasRetirementAllowance: true }), "careerUp").status).toBe("○");
  });

  it("重点支援2名＋その他1名＝80万×2＋40万＝200万円", () => {
    expect(grant(run(), "careerUp").estimatedAmount).toContain("2,000,000");
  });

  it("加算は3種類（転換制度20万・多様な正社員40万・情報公表20万）を各1事業所1回で案内し、断定的な「最大40万」は言わない", () => {
    const e = grant(run(), "careerUp").estimatedAmount ?? "";
    expect(e).toContain("20万円");
    expect(e).toContain("40万円");
    expect(e).not.toContain("最大40万円");
  });

  it("「交付決定前〜」はキャリアアップに無い概念（業務改善・働き方改革のみ）", () => {
    expect(grant(run(), "careerUp").risks.some((x) => x.includes("交付決定前"))).toBe(false);
    expect(grant(run(), "gyomukaizen").risks.some((x) => x.includes("交付決定前"))).toBe(true);
    expect(grant(run(), "hatarakikata").risks.some((x) => x.includes("交付決定前"))).toBe(true);
  });

  it("通算5年超の有期は無期扱い・支給申請は賃金支払日の翌日から2か月以内、をリスクに出す", () => {
    const risks = grant(run(), "careerUp").risks.join("\n");
    expect(risks).toContain("通算5年");
    expect(risks).toContain("2か月以内");
  });
});

describe("働き方改革推進支援助成金・労働時間短縮・年休促進支援コース（交付要綱・支給要領）", () => {
  it("常時10人以上の事業場は、就業規則が「届出済み」でないと○にならない（支給要領 第1(3)）", () => {
    expect(grant(run({ employeeCount: 12, workRulesStatus: "作成済み未届" }), "hatarakikata").status).toBe("△");
    expect(grant(run({ employeeCount: 12, workRulesStatus: "届出済み" }), "hatarakikata").status).toBe("○");
  });

  it("年休管理簿・設定改善法の3措置は入力項目に無いので常に要確認として示す", () => {
    const s = grant(run(), "hatarakikata").shortfalls.join("\n");
    expect(s).toContain("年休管理簿");
    expect(s).toContain("設定改善法");
  });

  it("交付額は1,000円未満を切り捨てる（交付要綱第6条）：123万4,567円×80% → 98万7,000円", () => {
    const e = grant(run({ employeeCount: 8, equipmentPrice: 1234567 }), "hatarakikata").estimatedAmount ?? "";
    expect(e).toContain("987,000");
  });

  it("賃金引上げ・割増賃金率引上げの加算がある旨を示す（上限は150万円で頭打ちではない）", () => {
    const e = grant(run(), "hatarakikata").estimatedAmount ?? "";
    expect(e).toContain("加算");
  });

  it("成果目標①の上限額は、実施前後の36協定の時間数の向きが正しい（設定）", () => {
    const caps = getCriteria().hatarakikata.goal1CapsByType;
    const find = (frag: string) => Object.entries(caps).find(([k]) => k.includes(frag))?.[1];
    expect(find("月80時間超 → 月60時間以下")).toBe(1500000);
    expect(find("月60超80時間以下 → 月60時間以下")).toBe(1000000);
    expect(find("月80時間超 → 月60超80時間以下")).toBe(500000);
  });

  it("成果目標①の前提（月45時間超の実態）・同一成果目標の再申請不可などのリスクを出す", () => {
    const risks = grant(run(), "hatarakikata").risks.join("\n");
    expect(risks).toContain("月45時間");
    expect(risks).toContain("同じ成果目標");
  });
});

describe("コンプライアンス系の不支給リスク（助成金ごとに根拠のあるものだけ）", () => {
  it("不正受給は5年（キャリアアップ パンフレット・働き方改革 交付要綱）", () => {
    for (const g of run({ noFraudPast3y: false }).grants) {
      expect(g.risks.some((x) => x.includes("過去5年"))).toBe(true);
      expect(g.risks.some((x) => x.includes("過去3年"))).toBe(false);
    }
  });

  it("会社都合離職の注意は、根拠のある業務改善（解雇は不交付事由）とキャリアアップ（6か月前〜1年）にだけ出す", () => {
    const r = run({ companyReasonLeavers: 2 });
    expect(grant(r, "careerUp").risks.some((x) => x.includes("会社都合離職者が2名"))).toBe(true);
    expect(grant(r, "gyomukaizen").risks.some((x) => x.includes("会社都合離職者が2名"))).toBe(true);
    expect(grant(r, "hatarakikata").risks.some((x) => x.includes("会社都合離職者"))).toBe(false);
  });
});
