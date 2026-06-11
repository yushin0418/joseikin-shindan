import type { Criteria } from "./criteria";
import { getCriteria } from "./criteria";
import type { DiagnosisInput } from "./validation";

export type Status = "○" | "△" | "×";

export interface GrantResult {
  key: "gyomukaizen" | "hatarakikata" | "careerUp";
  label: string;
  status: Status;
  /** 対象理由（満たしている要件） */
  reasons: string[];
  /** 不足要件（対象要件のうち未充足・要確認） */
  shortfalls: string[];
  /** 想定リスク（対象要件とは別の不支給リスク等） */
  risks: string[];
  /** 次のアクション */
  actions: string[];
  /** 必要書類 */
  requiredDocs: string[];
}

export interface DiagnosisResult {
  overallRank: "A" | "B" | "C";
  overallLabel: string;
  eligibleCount: number;
  grants: GrantResult[];
  criteriaVersion: string;
  disclaimer: string;
}

/** ○=2, △=1, ×=0 として要件充足度からステータスを決める小ヘルパ */
function decideStatus(metAll: boolean, anyFatal: boolean): Status {
  if (anyFatal) return "×";
  return metAll ? "○" : "△";
}

/** 36協定・就業規則の状態を真偽に正規化 */
function has36Filed(input: DiagnosisInput): boolean {
  return input.agreement36Status === "届出済み";
}
function workRulesFiled(input: DiagnosisInput): boolean {
  return input.workRulesStatus === "届出済み";
}
function workRulesExists(input: DiagnosisInput): boolean {
  return input.workRulesStatus !== "未作成";
}

/** 入力からコンプライアンス系の不支給リスクを抽出（全助成金共通で付与） */
function complianceRisks(input: DiagnosisInput): string[] {
  const r: string[] = [];
  if (!input.noFraudPast3y) {
    r.push("過去3年以内に助成金の不正受給があるため、原則不支給。");
  }
  if (!input.noLaborLawViolation) {
    r.push("過去1年以内に労働関係法令の違反があるため、不支給となる可能性が高い。");
  }
  if (input.companyReasonLeavers > 0) {
    r.push(
      `直近6か月に会社都合離職者が${input.companyReasonLeavers}名おり、支給額の減額・不支給につながる場合がある。`,
    );
  }
  if (input.employmentContractsStatus !== "はい") {
    r.push("雇用契約書が全員分揃っていない場合、申請・審査に支障が出る。");
  }
  return r;
}

// ---------------------------------------------------------------------------
// 業務改善助成金
// ---------------------------------------------------------------------------
function judgeGyomukaizen(input: DiagnosisInput, c: Criteria): GrantResult {
  const g = c.gyomukaizen;
  const reasons: string[] = [];
  const shortfalls: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  // 1) 中小企業判定（業種区分 × 従業員数）
  const smeMax =
    g.smeMaxRegularEmployeesByCategory[input.industryCategory] ??
    g.smeMaxRegularEmployeesByCategory["その他"];
  const isSme = input.employeeCount <= smeMax;
  if (isSme) {
    reasons.push(
      `中小企業に該当（${input.industryCategory}：従業員 ${input.employeeCount}名 ≦ ${smeMax}名）`,
    );
  } else {
    shortfalls.push(
      `中小企業の規模要件を超過の可能性（${input.industryCategory}：${input.employeeCount}名 > ${smeMax}名）。※資本金基準でも判定されるため要確認`,
    );
  }

  // 2) 会社内の最低賃金（地域別最低賃金との差額は社労士が照合）
  if (input.inHouseMinWage <= 0) {
    shortfalls.push("会社内の最低賃金が未入力（追加確認が必要）");
  } else {
    reasons.push(`会社内の最低賃金 ${input.inHouseMinWage.toLocaleString()}円`);
  }
  shortfalls.push(
    `地域別最低賃金との差額（${g.minWageGapYen}円以内）は、社労士が最新の地域別最低賃金と照合して確認（システム未判定）`,
  );

  // 3) 賃上げ予定
  const hasRaise = input.plannedWageRaise > 0 && input.wageRaiseHeadcount > 0;
  if (hasRaise) {
    reasons.push(
      `賃上げ予定あり（+${input.plannedWageRaise}円／対象${input.wageRaiseHeadcount}名）`,
    );
  } else {
    shortfalls.push("事業場内最低賃金の引上げ予定が未設定（追加確認が必要）");
  }

  // 4) 生産性向上設備の導入予定
  const hasInvest =
    input.willInvestEquipment &&
    !!input.equipmentName &&
    (input.equipmentPrice ?? 0) > 0;
  if (input.willInvestEquipment && !hasInvest) {
    shortfalls.push("設備導入予定はあるが設備名・金額が未確定（見積取得が必要）");
  } else if (hasInvest) {
    reasons.push(
      `生産性向上に資する設備導入予定あり（${input.equipmentName}：${input.equipmentPrice?.toLocaleString()}円）`,
    );
  } else {
    shortfalls.push("生産性向上設備等の導入予定なし（本助成金は設備投資等が前提）");
  }

  // リスク（対象要件とは分離）
  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input));
  risks.push("交付決定前に設備を発注・支払いすると対象外。発注時期の管理が必須。");
  if (!input.hasWageLedger) risks.push("賃金台帳が未整備だと事業場内最低賃金の確認ができず申請に支障。");

  // ステータス決定
  const fatal = !isSme && false; // 規模超過は資本金基準もあるため即×にはしない
  const metAll = isSme && hasRaise && hasInvest;
  const noneCore = !hasRaise && !hasInvest; // 中核要件が両方欠落
  const status: Status = noneCore ? "×" : decideStatus(metAll, fatal);

  // アクション
  if (status === "○") {
    actions.push("交付申請書・事業実施計画書の作成に着手");
    actions.push("設備の見積書（原則相見積り）を取得");
    actions.push("引上げ後賃金を就業規則・賃金規定に反映");
  } else if (status === "△") {
    if (!hasRaise) actions.push("賃上げ額・対象人数を確定する");
    if (!hasInvest) actions.push("導入設備と概算金額・見積先を確定する");
    actions.push("地域別最低賃金と会社内最低賃金の差額要件を社労士が確認");
    actions.push("社労士に最新のコース区分・助成上限を確認");
  } else {
    actions.push("まず賃上げ計画と設備投資計画の有無を整理する");
  }

  return {
    key: "gyomukaizen",
    label: g.label,
    status,
    reasons,
    shortfalls,
    risks,
    actions,
    requiredDocs: g.requiredDocs,
  };
}

// ---------------------------------------------------------------------------
// 働き方改革推進支援助成金
// ---------------------------------------------------------------------------
function judgeHatarakikata(input: DiagnosisInput, c: Criteria): GrantResult {
  const h = c.hatarakikata;
  const reasons: string[] = [];
  const shortfalls: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  // 1) 36協定
  const filed36 = has36Filed(input);
  if (filed36) {
    reasons.push("36協定を締結・届出済み（本助成金の前提を充足）");
  } else if (input.agreement36Status === "作成済み未届") {
    shortfalls.push("36協定は作成済みだが未届出（届出が前提）");
  } else {
    shortfalls.push("36協定が未作成（締結・届出が前提）");
  }

  // 2) 労働時間改善の取組予定
  if (input.willImproveWorktime) {
    reasons.push("労働時間の改善（時間外削減・年休促進・勤務間インターバル等）に取り組む予定あり");
  } else {
    shortfalls.push("労働時間改善の取組予定が未設定（成果目標の設定が必要）");
  }

  // 3) 労務管理機器等の導入予定
  const hasInvest = input.willInvestEquipment && !!input.equipmentName;
  if (hasInvest) {
    reasons.push(`取組のための設備・機器導入予定あり（${input.equipmentName}）`);
  } else {
    shortfalls.push("労務管理用機器・システム等の導入予定が未確定");
  }

  // 労災加入（適用事業主であること）
  if (!input.hasLaborInsurance) {
    shortfalls.push("労災保険の適用が確認できません（適用事業主であることが要件）");
  }

  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input));
  risks.push("成果目標が未達の場合、支給額の減額または不支給となる。");
  if (filed36 && !workRulesFiled(input)) {
    risks.push("就業規則が未届出だと労働時間制度の整備状況の確認に支障が出る場合がある。");
  }

  const has36 = filed36;
  const metAll = has36 && input.willImproveWorktime && hasInvest && input.hasLaborInsurance;
  // 36協定は前提要件のため、欠落時は×寄り
  const status: Status = !has36 ? "×" : metAll ? "○" : "△";

  if (status === "○") {
    actions.push("申請コース（労働時間短縮・年休促進／勤務間インターバル等）を選定");
    actions.push("成果目標と取組内容を計画書に落とし込む");
    actions.push("取組（設備・研修・コンサル等）の見積書を取得");
  } else if (status === "△") {
    if (!input.willImproveWorktime) actions.push("設定可能な成果目標を社労士と整理する");
    if (!hasInvest) actions.push("取組に用いる機器・システムを具体化する");
    if (!input.hasLaborInsurance) actions.push("労災保険の適用状況を確認する");
  } else {
    actions.push("まず36協定を締結・届出する");
  }

  return {
    key: "hatarakikata",
    label: h.label,
    status,
    reasons,
    shortfalls,
    risks,
    actions,
    requiredDocs: h.requiredDocs,
  };
}

// ---------------------------------------------------------------------------
// キャリアアップ助成金（正社員化コース）
// ---------------------------------------------------------------------------
function judgeCareerUp(input: DiagnosisInput, c: Criteria): GrantResult {
  const cu = c.careerUp;
  const reasons: string[] = [];
  const shortfalls: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  // 1) 有期雇用労働者の存在（雇用保険加入の有期 + 週20h未満の有期）
  const fixedTermTotal =
    input.fixedTermInsuredCount + input.under20hFixedTermCount;
  const hasFixedTerm = fixedTermTotal > 0;
  if (hasFixedTerm) {
    reasons.push(
      `有期契約労働者が在籍（雇用保険加入${input.fixedTermInsuredCount}名／週20時間未満${input.under20hFixedTermCount}名）＝転換対象になり得る`,
    );
  } else {
    shortfalls.push("有期雇用労働者が在籍していません（転換対象者が必要）");
  }

  // 2) 正社員転換予定
  const hasConversion = input.plannedConversions > 0;
  if (hasConversion) {
    reasons.push(`正社員転換予定あり（${input.plannedConversions}名）`);
  } else {
    shortfalls.push("正社員転換予定人数が未設定（追加確認が必要）");
  }

  // 3) キャリアアップ計画の整備可能性
  if (input.canPrepareCareerPlan) {
    reasons.push("キャリアアップ計画の整備が可能");
  } else {
    shortfalls.push("キャリアアップ計画の作成・提出体制が未確認（事前提出が必要）");
  }

  // 4) 就業規則改定可能性（転換制度の規定）
  if (input.canReviseWorkRules || workRulesExists(input)) {
    reasons.push("就業規則改定により正社員転換制度を規定可能");
  } else {
    shortfalls.push("就業規則が未作成のため、正社員転換制度の規定整備が必要");
  }

  // 5) 賃金増額率（転換時に設定値以上の増額が必要）
  const ratePct = (cu.minWageIncreaseRate * 100).toFixed(0);
  shortfalls.push(
    `転換時に賃金を${ratePct}%以上増額する必要（増額幅の確認が必要）`,
  );

  // 雇用保険適用
  if (!input.hasEmploymentIns) {
    shortfalls.push("雇用保険の適用が確認できません（雇用保険適用事業所が要件）");
  }

  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input));
  risks.push("転換制度を就業規則に規定する前に転換すると対象外。");
  risks.push("転換前後で所定割合以上の賃金増額がない場合は不支給。");

  const coreMet = hasFixedTerm && hasConversion && input.hasEmploymentIns;
  const planMet = input.canPrepareCareerPlan && (input.canReviseWorkRules || workRulesExists(input));
  const status: Status = !hasFixedTerm
    ? "×"
    : coreMet && planMet
      ? "○"
      : "△";

  if (status === "○") {
    actions.push("キャリアアップ計画書を作成し管轄労働局へ提出");
    actions.push("就業規則に正社員転換制度を規定");
    actions.push("転換後の賃金増額幅が要件を満たすか確認");
  } else if (status === "△") {
    if (!hasConversion) actions.push("正社員転換の対象者・時期を確定する");
    if (!input.canPrepareCareerPlan) actions.push("キャリアアップ管理者の設置と計画作成体制を整える");
    if (!(input.canReviseWorkRules || workRulesExists(input))) actions.push("就業規則の改定方針を決める");
  } else {
    actions.push("まず有期雇用労働者の在籍状況を整理する");
  }

  return {
    key: "careerUp",
    label: cu.label,
    status,
    reasons,
    shortfalls,
    risks,
    actions,
    requiredDocs: cu.requiredDocs,
  };
}

// ---------------------------------------------------------------------------
// 総合評価
// ---------------------------------------------------------------------------
function overall(grants: GrantResult[]): {
  rank: "A" | "B" | "C";
  label: string;
  eligibleCount: number;
} {
  const eligibleCount = grants.filter((g) => g.status === "○").length;
  const triangleCount = grants.filter((g) => g.status === "△").length;

  if (eligibleCount >= 1) {
    return { rank: "A", label: "すぐ申請準備可能", eligibleCount };
  }
  if (triangleCount >= 1) {
    return { rank: "B", label: "要件整備後に申請可能", eligibleCount };
  }
  return { rank: "C", label: "現状では難しい", eligibleCount };
}

/** メインのエントリポイント。設定ファイルを差し替えるだけで判定が変わる */
export function runDiagnosis(
  input: DiagnosisInput,
  criteria: Criteria = getCriteria(),
): DiagnosisResult {
  const grants: GrantResult[] = [
    judgeGyomukaizen(input, criteria),
    judgeHatarakikata(input, criteria),
    judgeCareerUp(input, criteria),
  ];

  const o = overall(grants);

  return {
    overallRank: o.rank,
    overallLabel: o.label,
    eligibleCount: o.eligibleCount,
    grants,
    criteriaVersion: criteria.version,
    disclaimer: criteria.disclaimer,
  };
}
