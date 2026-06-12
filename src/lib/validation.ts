import { z } from "zod";

const intNonNeg = z.coerce.number().int().min(0, "0以上で入力してください");
const yen = z.coerce.number().int().min(0, "0以上で入力してください");
const optStr = z.string().trim().max(300).optional().or(z.literal(""));

/** 入力フォーム → 診断のスキーマ（ヒヤリングシート全項目）。XSS/不正値対策の中核 */
export const diagnosisInputSchema = z
  .object({
    // 基本情報
    companyName: z.string().trim().min(1, "会社名は必須です").max(120),
    corporateNumber: z.string().trim().max(30).optional().or(z.literal("")),
    address: z.string().trim().min(1, "所在地は必須です").max(200),
    industry: z.string().trim().min(1, "業種は必須です").max(80),
    industryCategory: z.enum(["小売業", "サービス業", "卸売業", "製造業その他", "その他"]),
    orgType: z.enum(["法人", "個人事業"]),
    capitalYen: yen,
    contactName: z.string().trim().max(80).optional().or(z.literal("")),
    contactTel: z.string().trim().max(40).optional().or(z.literal("")),
    contactEmail: z.string().trim().email("メールアドレスの形式が不正です").max(120).optional().or(z.literal("")),
    hasBranch: z.boolean(),
    branchNote: optStr,

    // Q1 従業員（全体=A+B+C+D）
    employeeCount: intNonNeg,
    regularStaffCount: intNonNeg,
    permanentInsuredCount: intNonNeg,
    fixedTermInsuredCount: intNonNeg,
    under20hUninsuredCount: intNonNeg,
    under20hFixedTermCount: intNonNeg,
    inHouseMinWage: yen,
    regionalMinWage: yen,

    // 労務・コンプライアンス
    hasLaborInsurance: z.boolean(),
    hasEmploymentIns: z.boolean(),
    hasSocialInsurance: z.boolean(),
    agreement36Status: z.enum(["届出済み", "作成済み未届", "未作成"]),
    agreement36Date: optStr,
    workRulesStatus: z.enum(["届出済み", "作成済み未届", "未作成"]),
    hasWageLedger: z.boolean(),
    hasAttendanceBook: z.boolean(),
    hasEmployeeRoster: z.boolean(),
    employmentContractsStatus: z.enum(["はい", "いいえ", "その他"]),
    employmentContractsNote: optStr,

    // 就業規則がない場合の勤務条件
    workDays: optStr,
    holidays: optStr,
    vacations: optStr,
    workHours: optStr,
    breakTime: optStr,
    allowance1Name: optStr,
    allowance1Amount: optStr,
    allowance2Name: optStr,
    allowance2Amount: optStr,
    allowance3Name: optStr,
    allowance3Amount: optStr,

    // 賃金
    payClosingDay: optStr,
    payDay: optStr,
    hasRaiseSystem: z.boolean(),
    raiseMonth: optStr,
    plannedWageRaise: yen,
    wageRaiseHeadcount: intNonNeg,

    // 定年・賞与・退職金
    retirementSystem: z.enum(["65歳", "60歳継続雇用", "定年なし", ""]).optional(),
    hasBonus: z.boolean(),
    bonusSummer: optStr,
    bonusWinter: optStr,
    hasRetirementAllowance: z.boolean(),

    // 設備投資
    willInvestEquipment: z.boolean(),
    equipmentName: z.string().trim().max(120).optional().or(z.literal("")),
    equipmentPrice: z.coerce.number().int().min(0).optional(),
    equipmentVendor: optStr,
    equipmentPurpose: optStr,
    productivityEffect: optStr,

    // 正社員転換
    plannedConversions: intNonNeg,
    prioritySupportConversions: intNonNeg,
    conversionDate: z.string().trim().max(20).optional().or(z.literal("")),

    // 働き方改革：成果目標
    hatarakiGoal1: z.boolean(),
    hatarakiGoal1Type: z
      .enum(["", "月60h以下→月60超80h以下", "月60h以下→月80h超", "月60超80h→月80h超"])
      .optional(),
    hatarakiGoal2: z.boolean(),
    hatarakiGoal3: z.boolean(),

    // 状況・不支給リスク関連
    pastSubsidies: optStr,
    sharoshiContract: z.enum(["なし", "顧問", "スポット"]),
    companyReasonLeavers: intNonNeg,
    over60Insured: intNonNeg,
    over50FixedTerm: intNonNeg,
    noFraudPast3y: z.boolean(),
    noLaborLawViolation: z.boolean(),

    // 取組予定（判定補助）
    willImproveWorktime: z.boolean(),
    canPrepareCareerPlan: z.boolean(),
    canReviseWorkRules: z.boolean(),
  })
  .strict();

export type DiagnosisInput = z.infer<typeof diagnosisInputSchema>;

/** ログインスキーマ */
export const loginSchema = z.object({
  email: z.string().trim().email("メールアドレスの形式が不正です"),
  password: z.string().min(1, "パスワードは必須です").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
