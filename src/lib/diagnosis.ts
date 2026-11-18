import type { Criteria } from "./criteria";
import { getCriteria } from "./criteria";
import { DEFAULT_WARN_DAYS, deadlineInfo } from "./deadline";
import type { DeadlineDef } from "./deadline";
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
  /** 期限（日付のみ保存。「あと◯日」は表示のたびに計算する） */
  deadlines?: DeadlineDef[];
}

export interface DiagnosisResult {
  overallRank: "A" | "B" | "C";
  overallLabel: string;
  eligibleCount: number;
  grants: GrantResult[];
  criteriaVersion: string;
  disclaimer: string;
  /** 期限の注意喚起を始める残り日数（表示時に使う） */
  deadlineWarnDays?: number;
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

/** 中小企業判定（業種区分ごとに 資本金以下 OR 従業員以下 で該当） */
function smeInfo(input: DiagnosisInput, g: Criteria["gyomukaizen"]) {
  const empMax =
    g.smeMaxRegularEmployeesByCategory[input.industryCategory] ??
    g.smeMaxRegularEmployeesByCategory["その他"];
  const capMax =
    g.smeMaxCapitalByCategory[input.industryCategory] ??
    g.smeMaxCapitalByCategory["その他"];
  const byEmp = input.employeeCount <= empMax;
  const byCap = input.capitalYen > 0 && input.capitalYen <= capMax;
  return { isSme: byEmp || byCap, empMax, capMax, byEmp, byCap };
}

const man = (yen: number) => `${(yen / 10000).toLocaleString()}万円`;

/**
 * 入力からコンプライアンス系の不支給リスクを抽出する。助成金ごとに根拠のあるものだけを出す。
 * （入力項目 noFraudPast3y は列名が古いまま。内容は「不正受給がない」で、期間は制度に合わせて5年として扱う）
 */
function complianceRisks(input: DiagnosisInput, key: GrantResult["key"]): string[] {
  const r: string[] = [];
  if (!input.noFraudPast3y) {
    r.push("過去5年以内に助成金の不正受給があるため、不支給となる（5年間は受給できない）。");
  }
  if (!input.noLaborLawViolation) {
    r.push(
      key === "gyomukaizen"
        ? "労働基準監督署の是正勧告を受けている場合は申請できない（申請書提出日の前日から1年前の日〜実績報告日等まで。Q&A問48）。"
        : "過去1年以内に労働関係法令の違反があるため、不支給となる可能性が高い（働き方改革 交付要綱：交付申請日の前日から過去1年間）。",
    );
  }
  if (input.companyReasonLeavers > 0) {
    if (key === "careerUp") {
      r.push(
        `直近6か月に会社都合離職者が${input.companyReasonLeavers}名。転換日の前日から6か月前〜1年経過日までに事業主都合で雇用保険被保険者を離職させている場合は不支給。特定受給資格離職者の割合が6%を超える場合も不支給（該当者3人以下は除く）。`,
      );
    } else if (key === "gyomukaizen") {
      r.push(
        `直近6か月に会社都合離職者が${input.companyReasonLeavers}名。解雇は本助成金の不交付事由（案内）のため、内容の確認が必要。`,
      );
    }
    // 働き方改革の基本の不交付事由に解雇は含まれない（賃上げ加算を追加する場合のみ関係）ため出さない
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

  // 1) 中小企業判定（業種区分ごとに 資本金以下 OR 従業員以下）
  const sme = smeInfo(input, g);
  const isSme = sme.isSme;
  if (isSme) {
    reasons.push(
      `中小企業に該当（${input.industryCategory}：従業員${input.employeeCount}名≦${sme.empMax}名${sme.byCap ? `／資本金${man(input.capitalYen)}≦${man(sme.capMax)}` : ""}）`,
    );
  } else {
    shortfalls.push(
      `中小企業の規模要件を超過の可能性（${input.industryCategory}：従業員${sme.empMax}名・資本金${man(sme.capMax)}のいずれも超過）`,
    );
  }

  // 1b) 労働保険（労災・雇用保険）への加入は必須。未加入・保険料滞納中は助成を受けられない（Q&A問4）
  const laborOk = input.hasLaborInsurance && input.hasEmploymentIns;
  if (laborOk) {
    reasons.push("労働保険（労災保険・雇用保険）に加入済み");
  } else {
    shortfalls.push(
      "労働保険（労災保険・雇用保険）への加入が必須です（未加入・保険料の滞納中は助成を受けられません。Q&A問4）",
    );
  }

  // 2) 事業場内最低賃金が地域別最低賃金「未満」であること（要領上の対象要件）
  let wageEligible = true;
  if (input.inHouseMinWage <= 0) {
    shortfalls.push("事業場内最低賃金が未入力（追加確認が必要）");
  } else if (input.regionalMinWage <= 0) {
    reasons.push(`事業場内最低賃金 ${input.inHouseMinWage.toLocaleString()}円`);
    shortfalls.push("地域別最低賃金が未入力のため「事業場内＜地域別」を判定できません（社労士が照合）");
  } else if (input.inHouseMinWage < input.regionalMinWage) {
    reasons.push(
      `事業場内最低賃金${input.inHouseMinWage.toLocaleString()}円 ＜ 地域別最低賃金${input.regionalMinWage.toLocaleString()}円（対象要件を充足）`,
    );
  } else {
    wageEligible = false;
    shortfalls.push(
      `事業場内最低賃金${input.inHouseMinWage.toLocaleString()}円が地域別最低賃金${input.regionalMinWage.toLocaleString()}円以上です。本助成金は事業場内最賃が地域別最賃「未満」であることが要件のため、対象外の可能性`,
    );
  }

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

  // 4b) 助成対象経費の下限は税抜10万円（Q&A問25。複数の設備の合計で判定）
  const costOk = !hasInvest || (input.equipmentPrice ?? 0) >= g.minEligibleCostYen;
  if (!costOk) {
    shortfalls.push(
      `助成対象経費の下限（税抜${man(g.minEligibleCostYen)}）に満たない可能性があります（入力額：${(input.equipmentPrice ?? 0).toLocaleString()}円。税込で入力している場合は税抜に直して確認。複数の設備の合計で判定）`,
    );
  }

  // 5) 想定助成額の算定（要領の上限額表 × 助成率）
  if (course && input.wageRaiseHeadcount > 0 && hasInvest && input.inHouseMinWage > 0) {
    // 「事業場規模30人未満」は申請事業場の規模で判断される。入力は会社全体の従業員数のため近似
    const isSmallEmployer = input.employeeCount < g.smallEmployerMaxEmployees;
    // 「10人以上」の上限区分は特例事業者（事業場内最賃1,050円未満 等）が10人以上を引き上げる場合のみ
    const isSpecialEmployer = input.inHouseMinWage < g.rate.boundaryYen;
    const useTenPlus = input.wageRaiseHeadcount >= 10 && isSpecialEmployer;
    const cap = useTenPlus
      ? course.tenPlus
      : gyomukaizenCap(course, input.wageRaiseHeadcount, isSmallEmployer);
    const rate = input.inHouseMinWage < g.rate.boundaryYen ? g.rate.below : g.rate.atOrAbove;
    const byRate = Math.floor((input.equipmentPrice ?? 0) * rate);
    const amount = Math.min(byRate, cap);
    const ratePct = `${Math.round(rate * 100)}%`;
    const sizeLabel = useTenPlus
      ? "10人以上区分（特例事業者）"
      : isSmallEmployer
        ? "事業場規模30人未満"
        : "30人以上";
    estimatedAmount =
      `約 ${amount.toLocaleString()}円` +
      `（${course.label}・${sizeLabel}・対象${input.wageRaiseHeadcount}名 → 上限${cap.toLocaleString()}円、` +
      `設備費${(input.equipmentPrice ?? 0).toLocaleString()}円×助成率${ratePct}=${byRate.toLocaleString()}円 の少ない方）`;
    reasons.push(`想定助成額：${estimatedAmount}`);
    if (input.wageRaiseHeadcount >= 10 && !isSpecialEmployer) {
      shortfalls.push(
        "引上げ人数10人以上の上限区分は特例事業者（事業場内最低賃金1,050円未満、または物価高騰等要件に該当）のみ対象です。現在の入力では「8人以上」の区分で算定しています（物価高騰等要件＝利益率が前年度比3%ポイント以上低下に該当する場合は要確認）",
      );
    }
    if (input.hasBranch) {
      shortfalls.push(
        "上限額の区分「事業場規模30人未満」は申請する事業場の規模で判断されます。入力の従業員数は会社全体のため、支店がある場合は申請事業場の人数で要確認",
      );
    }
  }

  // リスク（対象要件とは分離。要領・案内に基づく）
  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input, "gyomukaizen"));
  risks.push("交付決定前に設備の導入（納品・契約・支払い）を行うと助成の対象にならない（案内・Q&A問26）。");
  risks.push("賃金引上げは申請より後に行う必要がある（引上げ後の申請は不可）。地域別最低賃金の発効に合わせる場合は、申請後〜発効日の前日までに引き上げる（改正のお知らせ）。");
  risks.push("引上げ対象は、週所定労働時間20時間以上の雇用保険被保険者（雇入れ後6か月経過者）。");
  risks.push("引上げ後の事業場内最低賃金と同額を就業規則等に定める必要がある（複数回に分けた引上げは不可）。");
  risks.push("助成対象経費は税抜で判断。パソコン・スマホ・タブレット等は原則対象外（特例事業者の物価高騰等要件に該当する場合のみ新規導入が対象）、自動車（特殊用途自動車を除く）も対象外。");
  risks.push("契約予定額が10万円（税抜）以上の設備は、同一条件の二者以上の見積書（相見積り）が原則必要。");
  risks.push("同一事業所の申請は年度内1回まで。申請は事業場ごと。");
  if (!input.hasWageLedger) risks.push("賃金台帳が未整備だと事業場内最低賃金の確認ができず申請に支障。");

  // ステータス決定
  const metAll = isSme && hasRaise && hasInvest && wageEligible && laborOk && costOk;
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
  const isSme = smeInfo(input, c.gyomukaizen).isSme;

  if (input.hasLaborInsurance) {
    reasons.push("労災保険の適用事業主（本コースの対象要件を充足）");
  } else {
    shortfalls.push("労災保険の適用が確認できません（労災適用の中小企業事業主が対象）");
  }
  if (isSme) {
    reasons.push("中小企業に該当（本コースの対象）");
  } else {
    shortfalls.push("中小企業の規模要件を超過の可能性（本コースは中小企業限定。資本金・従業員で要確認）");
  }

  // 年休管理簿・就業規則等の整備（年5日の年休取得に向けて）
  // 常時10人以上の事業場は、年休の時季指定を記載した就業規則を「交付申請の前に」労基署へ届出済みであること（支給要領 第1(3)）
  const tenOrMore = input.employeeCount >= 10;
  const rulesOk = tenOrMore ? input.workRulesStatus === "届出済み" : workRulesExists(input);
  if (rulesOk) {
    reasons.push(
      tenOrMore
        ? "就業規則を労働基準監督署へ届出済み（常時10人以上の事業場の要件。年休の時季指定の記載内容は要確認）"
        : "就業規則等を整備済み",
    );
  } else if (tenOrMore) {
    shortfalls.push(
      "常時10人以上の事業場は、年次有給休暇の時季指定（年5日）の対象者・方法を記載した就業規則を、交付申請の前に労働基準監督署へ届出済みであることが必要です（支給要領 第1(3)）",
    );
  } else {
    shortfalls.push("就業規則が未作成（年休管理簿・就業規則等の整備が必要）");
  }
  // 年休管理簿・設定改善法の措置は入力項目にないため、常に要確認として示す
  shortfalls.push("年休管理簿を、すべての指定事業場で作成していること（支給要領 第1(3)）を確認");
  shortfalls.push(
    "設定改善法に基づく3つの措置をすべて実施すること（労使の話合いの機会の整備／労働時間等の苦情・要望の担当者の配置／事業実施計画の労働者への周知。交付要綱第4条第3項）を確認",
  );

  // 取り組みたいこと（残業削減＝成果目標①／有給取得促進＝成果目標②③ に対応。具体目標は社労士が設定）
  const wants: string[] = [];
  if (input.hatarakiGoal1) wants.push("残業（時間外労働）の削減 → 成果目標①");
  if (input.hatarakiGoal2) wants.push("有給休暇の取得促進 → 成果目標②③");
  if (input.hatarakiGoal3) wants.push("時間単位年休＋特別休暇 → 成果目標③");
  // 「取り組みたいこと」は任意。要件を満たす理由ではないので「対象理由」には入れず、
  // 次のアクション（成果目標は社労士がヒヤリングして設定）に回す。未選択でも判定は下げない。

  // 改善事業（設備・機器・研修・コンサル等）
  const hasInvest = input.willInvestEquipment && !!input.equipmentName;
  if (hasInvest) {
    reasons.push(`改善事業の取組予定あり（${input.equipmentName} 等）`);
  } else {
    shortfalls.push("改善事業（設備・機器・研修・コンサル等）の内容が未確定");
  }

  // 想定助成額の目安（補助率＋成果目標別の上限。正確な成果目標と金額は社労士が確定）
  const isSmall = input.employeeCount <= 30;
  const equipOver30man = (input.equipmentPrice ?? 0) > 300000;
  const rate = isSmall && hasInvest && equipOver30man ? h.subsidyRateSmall : h.subsidyRate;
  const ratePct = `${Math.round(rate * 100)}%`;
  const goal1Max = Math.max(...Object.values(h.goal1CapsByType));
  const roundYen = (n: number) => Math.floor(n / h.roundingYen) * h.roundingYen; // 1,000円未満切捨て（交付要綱第6条）
  estimatedAmount =
    `補助率 ${ratePct}（30人以下で、機器・ソフト等の導入を含み、改善事業の費用合計が30万円を超える場合は4/5）。` +
    `成果目標ごとの上限は ①時間外削減 ${man(h.goal2Cap)}〜${man(goal1Max)}（実施前後の36協定の時間数で決まる）・②年休の計画的付与 ${man(h.goal2Cap)}・③時間単位年休＋特別休暇 ${man(h.goal3Cap)}。` +
    `このほか、賃金引上げ・割増賃金率引上げの成果目標を追加すると上限が加算されます（目安に含まれません）。` +
    `正確な成果目標と金額は社労士が確定します` +
    ((input.equipmentPrice ?? 0) > 0
      ? `（参考：対象経費${(input.equipmentPrice ?? 0).toLocaleString()}円×${ratePct}=${roundYen((input.equipmentPrice ?? 0) * rate).toLocaleString()}円。ただし上限が適用）`
      : "");
  reasons.push(`想定助成額の目安：${estimatedAmount}`);

  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input, "hatarakikata"));
  risks.push("助成対象経費は交付決定日から支給申請日までに実際に支出した費用のみ。交付決定前の発注・支払い等は対象外（交付要綱第4条第4項）。");
  risks.push("成果目標が未達の場合、支給額の減額または不支給となる。");
  risks.push("成果目標①を選ぶには、令和8年4月1日以前の2年間に少なくとも1か月、月45時間を超える時間外労働の実態が必要（交付要綱第5条）。成果目標②③は、すでに同じ制度の労使協定を締結している場合は選べない。");
  risks.push("過去の年度を含め、同じ成果目標で交付決定を受けたことがある場合は、同じ成果目標では交付されない。同一年度の交付決定は1回まで。他の補助金と同じ改善事業・成果目標で重複して受けることはできない（交付要綱第11条第6項）。");
  risks.push("事業実施年度の前年度より前の保険年度に労働保険料を滞納し、現在まで解消されていない場合は交付されない（交付要綱第11条第5項）。");
  // 申請期限は config/criteria.json の deadlines から runDiagnosis() が付与する（日付の直書きはしない）

  const metAll = isSme && input.hasLaborInsurance && hasInvest && rulesOk;
  const status: Status = metAll ? "○" : "△";

  // 成果目標は社労士が設定する（お客様の希望があれば参考にする）
  actions.push(
    wants.length > 0
      ? `成果目標を社労士が設定する（お客様の希望：${wants.join("／")}）`
      : "成果目標（残業削減・年休取得促進など）を社労士がヒヤリングして設定する",
  );

  if (status === "○") {
    actions.push("改善事業（設備・機器・研修・コンサル等）の見積書を取得する");
    actions.push("交付申請書を管轄の労働局 雇用環境・均等部（室）へ提出する");
  } else {
    if (!input.hasLaborInsurance) actions.push("労災保険の適用状況を確認する");
    if (!hasInvest) actions.push("改善事業（機器・研修・コンサル等）を具体化する");
    if (!rulesOk) {
      actions.push(
        tenOrMore
          ? "年休の時季指定を記載した就業規則を作成し、交付申請の前に労働基準監督署へ届け出る"
          : "就業規則・年次有給休暇管理簿を整備する",
      );
    }
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

  // 企業規模（中小/大企業）— 資本金 OR 従業員で判定
  const sizeKey = smeInfo(input, c.gyomukaizen).isSme ? "中小企業" : "大企業";

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

  // 3) 想定支給額（有期→正規。重点支援対象者の人数で精密に算定）
  if (hasConversion) {
    const amt = cu.amounts[sizeKey]?.["有期→正規"];
    if (amt) {
      const priority = Math.min(input.prioritySupportConversions, input.plannedConversions);
      const normal = input.plannedConversions - priority;
      const total = priority * amt["重点支援"] + normal * amt["上記以外"];
      const addKey = sizeKey === "中小企業" ? "中小企業" : "大企業";
      const addText = Object.entries(cu.additions)
        .map(([name, v]) => `${name}${man(v[addKey])}`)
        .join("／");
      estimatedAmount =
        `${sizeKey}・有期→正規：重点支援${priority}名×${man(amt["重点支援"])}（2期・計12か月） ＋ その他${normal}名×${man(amt["上記以外"])} ` +
        `= 約 ${total.toLocaleString()}円。` +
        `このほか加算（各1事業所・通算1回、併給の可否は要確認）：${addText}`;
      reasons.push(`想定支給額：${estimatedAmount}`);
    }
  }

  // 3b) 転換先の正規雇用労働者の待遇要件：「賞与または退職金（いずれか1制度以上）」かつ「昇給」が
  //     就業規則等で規定・適用されていること（パンフレット 用語の定義、Q&A Q-1）
  const hasBonusOrRetire = input.hasBonus || input.hasRetirementAllowance;
  const treatmentOk = hasBonusOrRetire && input.hasRaiseSystem;
  if (treatmentOk) {
    reasons.push("正社員に「賞与または退職金」と「昇給」の制度あり（転換先の正規雇用労働者の要件。規定内容・水準は要確認）");
  } else {
    const lacking = [
      hasBonusOrRetire ? null : "賞与・退職金のいずれの制度もない",
      input.hasRaiseSystem ? null : "昇給制度がない",
    ].filter(Boolean);
    shortfalls.push(
      `転換先の正規雇用労働者に「賞与または退職金（いずれか1制度以上）」かつ「昇給」が就業規則等で規定・適用されている必要があります（現在：${lacking.join("・")}）。転換前に制度を整備すること`,
    );
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

  // 8) 社会保険：転換後は、社会保険の適用事業所なら社会保険にも加入させる必要がある
  if (!input.hasSocialInsurance) {
    shortfalls.push(
      "社会保険の加入状況を確認（社会保険の適用要件を満たす事業所は、転換後の労働者を社会保険に加入させる必要があります）",
    );
  }

  // 9) 対象労働者ごとの要件は入力項目にないため、常に要確認として示す
  shortfalls.push(
    "対象労働者ごとの要件を確認（非正規の雇用区分で通算6か月以上／正社員として雇う約束で採用した者でない／転換前日から過去3年以内に正規雇用・役員でない／事業主・取締役の3親等以内でない／新規学卒者は雇入れから1年経過 など）",
  );

  // リスク（要領に基づく）
  risks.push(...c.commonRisks);
  risks.push(...complianceRisks(input, "careerUp"));
  risks.push("キャリアアップ計画の提出前・転換制度の規定前に転換すると対象外（計画は各コースの実施日の前日までに提出）。");
  risks.push("転換後6か月以上継続雇用し、6か月分の賃金を支給した後に申請（先払いが必要）。支給申請は、6か月分の賃金を支払った日の翌日から2か月以内。");
  risks.push(`転換後6か月の賃金が転換前6か月より${ratePct}%以上増額していない場合は不支給。`);
  risks.push("転換後は雇用保険に加入させる必要がある（社会保険の適用事業所なら社会保険にも）。");
  risks.push("雇用された期間が通算5年を超える有期雇用労働者は無期雇用労働者として扱われ、支給額が低くなる（有期→正規の半額）。");
  risks.push(`支給申請は1年度1事業所あたり${cu.annualApplicantCap}名まで。`);

  const coreMet = hasFixedTerm && hasConversion && input.hasEmploymentIns;
  const planMet = input.canPrepareCareerPlan && (input.canReviseWorkRules || workRulesExists(input));
  const status: Status = !hasFixedTerm ? "×" : coreMet && planMet && treatmentOk ? "○" : "△";

  if (status === "○") {
    actions.push("キャリアアップ計画書を作成し、実施日の前日までに管轄労働局へ提出");
    actions.push("就業規則等に正社員転換制度を規定");
    actions.push("転換後6か月の賃金が転換前比3%以上増額になるか確認（賃金上昇要件確認ツール）");
  } else if (status === "△") {
    if (!hasConversion) actions.push("正社員転換の対象者・時期を確定する");
    if (!treatmentOk) actions.push("正社員に「賞与または退職金」と「昇給」の制度を就業規則等に規定する（転換前に整備）");
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
/**
 * 申請期限のルールを適用する（期限は config/criteria.json の deadlines）。
 * - 期限情報（日付）を結果に付与する。
 * - blocksApplication の期限を過ぎていれば申請不可として判定を「×」に落とす。
 * - 期限が近い（当日含む）場合は、不支給リスクと次のアクションに注意喚起を足す。
 */
function applyDeadlines(g: GrantResult, c: Criteria, now: Date): GrantResult {
  const defs: DeadlineDef[] | undefined = c.deadlines?.[g.key];
  if (!defs || defs.length === 0) return g;

  const warn = c.deadlineWarnDays ?? DEFAULT_WARN_DAYS;
  const out: GrantResult = {
    ...g,
    shortfalls: [...g.shortfalls],
    risks: [...g.risks],
    actions: [...g.actions],
    deadlines: defs,
  };

  for (const d of defs.filter((x) => x.blocksApplication)) {
    const info = deadlineInfo(d, now, warn);
    if (info.state === "passed") {
      out.status = "×";
      out.shortfalls.unshift(
        `${info.text}。今年度の受付は終了している可能性があるため、次年度の要領・受付時期の確認が必要`,
      );
      out.actions.unshift("次年度の要領・受付時期を確認し、改めて診断する");
    } else if (info.state === "today" || info.state === "soon") {
      out.risks.unshift(`${info.text}。予算の都合で期限前に受付が終了する場合がある`);
      if (out.status !== "×") {
        out.actions.unshift("申請期限が迫っています。交付申請の準備を最優先で進める");
      }
    }
  }
  return out;
}

/** now は期限判定の基準時刻（既定は現在。テストでは固定できる） */
export function runDiagnosis(
  input: DiagnosisInput,
  criteria: Criteria = getCriteria(),
  now: Date = new Date(),
): DiagnosisResult {
  const grants: GrantResult[] = [
    judgeGyomukaizen(input, criteria),
    judgeHatarakikata(input, criteria),
    judgeCareerUp(input, criteria),
  ].map((g) => applyDeadlines(g, criteria, now));

  const o = overall(grants);

  return {
    overallRank: o.rank,
    overallLabel: o.label,
    eligibleCount: o.eligibleCount,
    grants,
    criteriaVersion: criteria.version,
    disclaimer: criteria.disclaimer,
    deadlineWarnDays: criteria.deadlineWarnDays ?? DEFAULT_WARN_DAYS,
  };
}
