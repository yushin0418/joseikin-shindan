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
  /** 想定助成額（算定できた場合のみ。要領準拠の計算結果） */
  estimatedAmount?: string;
  /** 判定の根拠（出典） */
  source?: string;
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

/** 就業規則が作成済み（届出済み or 作成済み未届）か */
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
/** 引上げ額からコースを判定（90→70→50） */
function pickGyomukaizenCourse(raiseYen: number, g: Criteria["gyomukaizen"]) {
  if (raiseYen >= 90) return g.courses["90"];
  if (raiseYen >= 70) return g.courses["70"];
  if (raiseYen >= g.minRaiseYen) return g.courses["50"];
  return null;
}

/** 人数帯と事業場規模から助成上限額を取得 */
function gyomukaizenCap(
  course: Criteria["gyomukaizen"]["courses"][string],
  headcount: number,
  isSmallEmployer: boolean,
): number {
  const band = course.caps.find((b) => headcount <= b.maxHc) ?? course.caps[course.caps.length - 1];
  return isSmallEmployer ? band.small : band.normal;
}

function judgeGyomukaizen(input: DiagnosisInput, c: Criteria): GrantResult {
  const g = c.gyomukaizen;
  const reasons: string[] = [];
  const shortfalls: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];
  let estimatedAmount: string | undefined;

  // 1) 中小企業判定（業種区分 × 従業員数。※本来は資本金基準も併用）
  const smeMax =
    g.smeMaxRegularEmployeesByCategory[input.industryCategory] ??
    g.smeMaxRegularEmployeesByCategory["その他"];
  const isSme = input.employeeCount <= smeMax;
  if (isSme) {
    reasons.push(`中小企業に該当（${input.industryCategory}：従業員 ${input.employeeCount}名 ≦ ${smeMax}名）`);
  } else {
    shortfalls.push(
      `中小企業の規模要件を超過の可能性（${input.industryCategory}：${input.employeeCount}名 > ${smeMax}名）。※資本金基準でも判定されるため要確認`,
    );
  }

  // 2) 事業場内最低賃金が地域別最低賃金「未満」であること（要領上の対象要件）
  if (input.inHouseMinWage > 0) {
    reasons.push(`事業場内最低賃金 ${input.inHouseMinWage.toLocaleString()}円`);
  } else {
    shortfalls.push("事業場内最低賃金が未入力（追加確認が必要）");
  }
  shortfalls.push(
    "事業場内最低賃金が令和8年度の地域別最低賃金「未満」であることが要件。社労士が最新の地域別最低賃金と照合して確認（システム未判定）",
  );

  // 3) 賃上げ予定（50円以上）→ コース判定
  const course = pickGyomukaizenCourse(input.plannedWageRaise, g);
  const hasRaise = course !== null && input.wageRaiseHeadcount > 0;
  if (hasRaise && course) {
    reasons.push(
      `事業場内最低賃金を ${input.plannedWageRaise}円引上げ予定 → ${course.label}（対象${input.wageRaiseHeadcount}名）`,
    );
  } else if (input.plannedWageRaise > 0 && input.plannedWageRaise < g.minRaiseYen) {
    shortfalls.push(`引上げ額が${g.minRaiseYen}円未満です（本助成金は${g.minRaiseYen}円以上の引上げが必要）`);
  } else {
    shortfalls.push("事業場内最低賃金の引上げ予定（額・人数）が未設定（追加確認が必要）");
  }

  // 4) 生産性向上設備の導入予定
  const hasInvest =
    input.willInvestEquipment && !!input.equipmentName && (input.equipmentPrice ?? 0) > 0;
  if (input.willInvestEquipment && !hasInvest) {
    shortfalls.push("設備導入予定はあるが設備名・金額が未確定（見積取得が必要）");
  } else if (hasInvest) {
    reasons.push(
      `生産性向上に資する設備導入予定あり（${input.equipmentName}：${input.equipmentPrice?.toLocaleString()}円）`,
    );
  } else {
    shortfalls.push("生産性向上設備等の導入予定なし（本助成金は設備投資等が前提）");
  }

  // 5) 想定助成額の算定（要領の上限額表 × 助成率）
  if (course && input.wageRaiseHeadcount > 0 && hasInvest && input.inHouseMinWage > 0) {
    const isSmallEmployer = input.employeeCount < g.smallEmployerMaxEmployees;
    const cap = gyomukaizenCap(course, input.wageRaiseHeadcount, isSmallEmployer);
    const rate = input.inHouseMinWage < g.rate.boundaryYen ? g.rate.below : g.rate.atOrAbove;
    const byRate = Math.floor((input.equipmentPrice ?? 0) * rate);
    const amount = Math.min(byRate, cap);
    const ratePct = `${Math.round(rate * 100)}%`;
    estimatedAmount =
      `約 ${amount.toLocaleString()}円` +
      `（${course.label}・${isSmallEmployer ? "事業場規模30人未満" : "30人以上"}・対象${input.wageRaiseHeadcount}名 → 上限${cap.toLocaleString()}円、` +
      `設備費${(input.equipmentPrice ?? 0).toLocaleString()}円×助成率${ratePct}=${byRate.toLocaleString()}円 の少ない方）`;
    reasons.push(`想定助成額：${estimatedAmount}`);
  }

  // リスク（対象要件とは分離。要領・案内に基づく）
  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input));
  risks.push("交付決定前に設備の発注・購入・支払いを行うと対象外。");
  risks.push("引上げ対象は、週所定労働時間20時間以上の雇用保険被保険者（雇入れ後6か月経過者）。");
  risks.push("引上げ後の事業場内最低賃金と同額を就業規則等に定める必要がある（複数回に分けた引上げは不可）。");
  risks.push("同一事業所の申請は年度内1回まで。自動車（特殊用途車を除く）は助成対象外。");
  if (!input.hasWageLedger) risks.push("賃金台帳が未整備だと事業場内最低賃金の確認ができず申請に支障。");

  // ステータス決定
  const metAll = isSme && hasRaise && hasInvest;
  const noneCore = !hasRaise && !hasInvest;
  const status: Status = noneCore ? "×" : decideStatus(metAll, false);

  if (status === "○") {
    actions.push("交付申請書・事業実施計画書を作成し、管轄の都道府県労働局へ提出");
    actions.push("設備の見積書（原則相見積り）を取得");
    actions.push("引上げ後の事業場内最低賃金額を就業規則・賃金規定に反映");
  } else if (status === "△") {
    if (!hasRaise) actions.push(`賃上げ額（${g.minRaiseYen}円以上）・対象人数を確定する`);
    if (!hasInvest) actions.push("導入設備と概算金額・見積先を確定する");
    actions.push("最新の地域別最低賃金と事業場内最低賃金を社労士が照合");
  } else {
    actions.push("まず賃上げ計画（50円以上）と設備投資計画の有無を整理する");
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
    estimatedAmount,
    source: g.source,
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
  let estimatedAmount: string | undefined;

  // 対象事業主：労災適用 ＋ 中小企業（本コースは中小企業限定）
  const smeMax =
    c.gyomukaizen.smeMaxRegularEmployeesByCategory[input.industryCategory] ??
    c.gyomukaizen.smeMaxRegularEmployeesByCategory["その他"];
  const isSme = input.employeeCount <= smeMax;

  if (input.hasLaborInsurance) {
    reasons.push("労災保険の適用事業主（本コースの対象要件を充足）");
  } else {
    shortfalls.push("労災保険の適用が確認できません（労災適用の中小企業事業主が対象）");
  }
  if (isSme) {
    reasons.push(`中小企業に該当（${input.industryCategory}：従業員 ${input.employeeCount}名 ≦ ${smeMax}名）`);
  } else {
    shortfalls.push(`中小企業の規模要件を超過の可能性（本コースは中小企業限定。資本金基準でも要確認）`);
  }

  // 年休管理簿・就業規則等の整備（年5日の年休取得に向けて）
  if (workRulesExists(input)) {
    reasons.push("就業規則等を整備済み（年5日の年休取得に向けた年休管理簿等の整備が要件）");
  } else {
    shortfalls.push("就業規則が未作成（年5日の年休取得に向けた年休管理簿・就業規則等の整備が必要）");
  }

  // 成果目標（時間外削減・年休の計画的付与・時間単位年休＋特別休暇 から1つ以上）
  if (input.willImproveWorktime) {
    reasons.push("労働時間の改善（成果目標：時間外削減／年休の計画的付与等）に取り組む予定あり");
  } else {
    shortfalls.push("成果目標（時間外削減・年休の計画的付与・時間単位年休＋特別休暇 から1つ以上）の設定が必要");
  }

  // 改善事業（設備・機器・研修・コンサル等）
  const hasInvest = input.willInvestEquipment && !!input.equipmentName;
  if (hasInvest) {
    reasons.push(`改善事業の取組予定あり（${input.equipmentName} 等）`);
  } else {
    shortfalls.push("改善事業（設備・機器・研修・コンサル等）の内容が未確定");
  }

  // 助成率・上限の枠組み（補助率3/4、30人以下かつ機器導入で所要額30万円超なら4/5）
  const isSmall = input.employeeCount <= 30;
  const equipOver30man = (input.equipmentPrice ?? 0) > 300000;
  const rate = isSmall && hasInvest && equipOver30man ? h.subsidyRateSmall : h.subsidyRate;
  const ratePct = `${Math.round(rate * 100)}%`;
  estimatedAmount =
    `補助率 ${ratePct}（成果目標ごとの上限：①時間外削減 最大150万円・②年休計画付与 25万円・③時間単位年休＋特別休暇 25万円）。` +
    `対象経費×補助率 と 上限額 の低い方を助成` +
    ((input.equipmentPrice ?? 0) > 0
      ? `（例：対象経費${(input.equipmentPrice ?? 0).toLocaleString()}円×${ratePct}=${Math.floor((input.equipmentPrice ?? 0) * rate).toLocaleString()}円。ただし成果目標の上限が適用）`
      : "");
  reasons.push(`想定助成額の目安：${estimatedAmount}`);
  shortfalls.push("実際の助成額は、選択する成果目標と達成状況により決まるため要確認");

  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input));
  risks.push("交付決定前に取組（発注・支払い等）を行うと対象外。");
  risks.push("成果目標が未達の場合、支給額の減額または不支給となる。");
  risks.push("申請期限：交付申請は令和8年11月30日（予算により早期締切あり）、事業完了は令和9年1月31日。");

  const metAll = isSme && input.hasLaborInsurance && input.willImproveWorktime && hasInvest && workRulesExists(input);
  const status: Status = metAll ? "○" : "△";

  if (status === "○") {
    actions.push("成果目標（時間外削減／年休の計画的付与 等）を選定し計画書に落とし込む");
    actions.push("改善事業（設備・研修・コンサル等）の見積書を取得");
    actions.push("交付申請書を管轄の労働局 雇用環境・均等部（室）へ提出");
  } else {
    if (!input.hasLaborInsurance) actions.push("労災保険の適用状況を確認する");
    if (!input.willImproveWorktime) actions.push("設定可能な成果目標を社労士と整理する");
    if (!hasInvest) actions.push("改善事業（機器・研修・コンサル等）を具体化する");
    if (!workRulesExists(input)) actions.push("就業規則・年次有給休暇管理簿を整備する");
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
    estimatedAmount,
    source: h.source,
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
  let estimatedAmount: string | undefined;

  // 企業規模（中小/大企業）— 従業員数×業種区分で簡易判定
  const smeMax =
    c.gyomukaizen.smeMaxRegularEmployeesByCategory[input.industryCategory] ??
    c.gyomukaizen.smeMaxRegularEmployeesByCategory["その他"];
  const sizeKey = input.employeeCount <= smeMax ? "中小企業" : "大企業";

  // 1) 有期雇用労働者の存在（雇用保険加入の有期 + 週20h未満の有期）
  const fixedTermTotal = input.fixedTermInsuredCount + input.under20hFixedTermCount;
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

  // 3) 想定支給額（有期→正規・1人あたりの額 × 転換予定人数）
  if (hasConversion) {
    const amt = cu.amounts[sizeKey]?.["有期→正規"];
    if (amt) {
      const lo = amt["上記以外"] * input.plannedConversions;
      const hi = amt["重点支援"] * input.plannedConversions;
      estimatedAmount =
        `${sizeKey}・有期→正規：1人 ${(amt["上記以外"] / 10000).toLocaleString()}万〜${(amt["重点支援"] / 10000).toLocaleString()}万円` +
        `（重点支援対象者※は上限額）× 転換予定${input.plannedConversions}名 = 約 ${lo.toLocaleString()}〜${hi.toLocaleString()}円` +
        `（＋制度新設等の加算 最大40万円/事業所・1回）`;
      reasons.push(`想定支給額：${estimatedAmount}`);
      shortfalls.push(
        "※重点支援対象者＝雇入れ3年以上の有期 等。該当有無で支給額（2期制）が変わるため要確認",
      );
    }
  }

  // 4) 転換制度の規定（就業規則・労働協約）
  if (input.canReviseWorkRules || workRulesExists(input)) {
    reasons.push("就業規則等に正社員転換制度を規定可能（規定に基づく転換が要件）");
  } else {
    shortfalls.push("就業規則が未作成のため、正社員転換制度の規定整備が必要");
  }

  // 5) キャリアアップ計画（実施日の前日までに提出）
  if (input.canPrepareCareerPlan) {
    reasons.push("キャリアアップ計画の整備が可能");
  } else {
    shortfalls.push("キャリアアップ計画が未整備（実施日の前日までに労働局へ提出が必要）");
  }

  // 6) 賃金3%以上増額（システム未判定）
  const ratePct = (cu.minWageIncreaseRate * 100).toFixed(0);
  shortfalls.push(
    `転換後6か月の賃金を、転換前6か月より${ratePct}%以上増額する必要（増額幅は社労士が確認）`,
  );

  // 7) 雇用保険適用
  if (!input.hasEmploymentIns) {
    shortfalls.push("雇用保険の適用が確認できません（雇用保険適用事業所が要件）");
  }

  // リスク（要領に基づく）
  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input));
  risks.push("キャリアアップ計画の提出前・転換制度の規定前に転換すると対象外。");
  risks.push("転換後6か月以上継続雇用し、6か月分の賃金を支給した後に申請（先払いが必要）。");
  risks.push(`転換後6か月の賃金が転換前より${ratePct}%以上増額していない場合は不支給。`);
  risks.push("転換日の前日から6か月前〜1年経過日までに、事業主都合で雇用保険被保険者を解雇等していると不支給。");
  risks.push(`支給申請は1年度1事業所あたり${cu.annualApplicantCap}名まで。`);

  const coreMet = hasFixedTerm && hasConversion && input.hasEmploymentIns;
  const planMet = input.canPrepareCareerPlan && (input.canReviseWorkRules || workRulesExists(input));
  const status: Status = !hasFixedTerm ? "×" : coreMet && planMet ? "○" : "△";

  if (status === "○") {
    actions.push("キャリアアップ計画書を作成し、実施日の前日までに管轄労働局へ提出");
    actions.push("就業規則等に正社員転換制度を規定");
    actions.push("転換後6か月の賃金が転換前比3%以上増額になるか確認（賃金上昇要件確認ツール）");
  } else if (status === "△") {
    if (!hasConversion) actions.push("正社員転換の対象者・時期を確定する");
    if (!input.canPrepareCareerPlan) actions.push("キャリアアップ計画の作成・事前提出の体制を整える");
    if (!(input.canReviseWorkRules || workRulesExists(input))) actions.push("就業規則に転換制度を規定する");
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
    estimatedAmount,
    source: cu.source,
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
