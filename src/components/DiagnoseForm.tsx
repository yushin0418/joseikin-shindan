"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  // 基本情報
  companyName: string;
  corporateNumber: string;
  address: string;
  industry: string;
  industryCategory: string;
  orgType: string;
  capitalYen: number;
  contactName: string;
  contactTel: string;
  contactEmail: string;
  hasBranch: boolean;
  branchNote: string;
  // Q1 従業員
  employeeCount: number;
  regularStaffCount: number;
  permanentInsuredCount: number;
  fixedTermInsuredCount: number;
  under20hUninsuredCount: number;
  under20hFixedTermCount: number;
  inHouseMinWage: number;
  regionalMinWage: number;
  // 労務・コンプライアンス
  hasLaborInsurance: boolean;
  hasEmploymentIns: boolean;
  hasSocialInsurance: boolean;
  agreement36Status: string;
  agreement36Date: string;
  workRulesStatus: string;
  hasWageLedger: boolean;
  hasAttendanceBook: boolean;
  hasEmployeeRoster: boolean;
  employmentContractsStatus: string;
  employmentContractsNote: string;
  // 就業規則がない場合
  workDays: string;
  holidays: string;
  vacations: string;
  workHours: string;
  breakTime: string;
  allowance1Name: string;
  allowance1Amount: string;
  allowance2Name: string;
  allowance2Amount: string;
  allowance3Name: string;
  allowance3Amount: string;
  // 賃金
  payClosingDay: string;
  payDay: string;
  hasRaiseSystem: boolean;
  raiseMonth: string;
  plannedWageRaise: number;
  wageRaiseHeadcount: number;
  // 定年・賞与・退職金
  retirementSystem: string;
  hasBonus: boolean;
  bonusSummer: string;
  bonusWinter: string;
  hasRetirementAllowance: boolean;
  // 設備投資
  willInvestEquipment: boolean;
  equipmentName: string;
  equipmentPrice: number;
  equipmentVendor: string;
  equipmentPurpose: string;
  productivityEffect: string;
  // 正社員転換
  plannedConversions: number;
  prioritySupportConversions: number;
  conversionDate: string;
  // 働き方改革：成果目標
  hatarakiGoal1: boolean;
  hatarakiGoal1Type: string;
  hatarakiGoal2: boolean;
  hatarakiGoal3: boolean;
  // 状況・リスク
  pastSubsidies: string;
  sharoshiContract: string;
  companyReasonLeavers: number;
  over60Insured: number;
  over50FixedTerm: number;
  noFraudPast3y: boolean;
  noLaborLawViolation: boolean;
  // 取組予定
  willImproveWorktime: boolean;
  canPrepareCareerPlan: boolean;
  canReviseWorkRules: boolean;
};

// 記入例（申請ひな形株式会社）を初期値にして動作確認しやすくする
const initial: FormState = {
  companyName: "申請ひな形株式会社",
  corporateNumber: "1000001012345",
  address: "東京都豊島区",
  industry: "建設業",
  industryCategory: "その他",
  orgType: "法人",
  capitalYen: 10000000,
  contactName: "代表取締役 山田 花子",
  contactTel: "03-5954-0000",
  contactEmail: "",
  hasBranch: false,
  branchNote: "",
  employeeCount: 7,
  regularStaffCount: 3,
  permanentInsuredCount: 0,
  fixedTermInsuredCount: 3,
  under20hUninsuredCount: 1,
  under20hFixedTermCount: 0,
  inHouseMinWage: 1226,
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
  equipmentVendor: "池袋機械販売／ABCマシン",
  equipmentPurpose: "作業効率の向上",
  productivityEffect: "作業時間短縮による生産性向上",
  plannedConversions: 1,
  prioritySupportConversions: 1,
  conversionDate: "",
  hatarakiGoal1: true,
  hatarakiGoal1Type: "月60h以下→月80h超",
  hatarakiGoal2: false,
  hatarakiGoal3: false,
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

const CATEGORIES = ["小売業", "サービス業", "卸売業", "製造業その他", "その他"];
const STATUS3 = ["届出済み", "作成済み未届", "未作成"];
const RETIREMENT = ["", "65歳", "60歳継続雇用", "定年なし"];
const CONTRACTS = ["はい", "いいえ", "その他"];
const SHAROSHI = ["なし", "顧問", "スポット"];
const GOAL1TYPES = ["", "月60h以下→月60超80h以下", "月60h以下→月80h超", "月60超80h→月80h超"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-5">
      <legend className="px-2 text-sm font-bold text-brand">{title}</legend>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Text({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "" ? (placeholder ?? "未選択") : o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}

export function DiagnoseForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [csrf, setCsrf] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d) => setCsrf(d.token))
      .catch(() => setError("初期化に失敗しました。再読み込みしてください。"));
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "診断に失敗しました");
        setSubmitting(false);
        return;
      }
      router.push(`/result/${data.id}`);
    } catch {
      setError("通信エラーが発生しました");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section title="会社情報">
        <Text label="会社名" value={form.companyName} onChange={(v) => set("companyName", v)} />
        <Text label="法人番号" value={form.corporateNumber} onChange={(v) => set("corporateNumber", v)} />
        <Text label="所在地" value={form.address} onChange={(v) => set("address", v)} />
        <Text label="業種" value={form.industry} onChange={(v) => set("industry", v)} />
        <Select label="業種区分（中小企業判定用）" value={form.industryCategory} onChange={(v) => set("industryCategory", v)} options={CATEGORIES} />
        <Select label="法人・個人事業" value={form.orgType} onChange={(v) => set("orgType", v)} options={["法人", "個人事業"]} />
        <Text label="資本金額（円）※中小企業判定用" type="number" value={form.capitalYen} onChange={(v) => set("capitalYen", num(v))} />
        <Text label="ご担当者名" value={form.contactName} onChange={(v) => set("contactName", v)} />
        <Text label="連絡先TEL" value={form.contactTel} onChange={(v) => set("contactTel", v)} />
        <Text label="メールアドレス" type="email" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} />
        <Check label="支店がある" checked={form.hasBranch} onChange={(v) => set("hasBranch", v)} />
        <Text label="支店名（任意）" value={form.branchNote} onChange={(v) => set("branchNote", v)} />
      </Section>

      <Section title="従業員（全体 = A+B+C+D）">
        <Text label="従業員数（全体）" type="number" value={form.employeeCount} onChange={(v) => set("employeeCount", num(v))} />
        <Text label="会社内の最低賃金（円）" type="number" value={form.inHouseMinWage} onChange={(v) => set("inHouseMinWage", num(v))} />
        <Text label="地域別最低賃金（円）" type="number" value={form.regionalMinWage} onChange={(v) => set("regionalMinWage", num(v))} />
        <Text label="A 正規社員数" type="number" value={form.regularStaffCount} onChange={(v) => set("regularStaffCount", num(v))} />
        <Text label="B 雇用保険加入の無期契約労働者数" type="number" value={form.permanentInsuredCount} onChange={(v) => set("permanentInsuredCount", num(v))} />
        <Text label="C 雇用保険加入の有期契約労働者数" type="number" value={form.fixedTermInsuredCount} onChange={(v) => set("fixedTermInsuredCount", num(v))} />
        <Text label="D 週20時間未満（雇用保険適用外）の労働者数" type="number" value={form.under20hUninsuredCount} onChange={(v) => set("under20hUninsuredCount", num(v))} />
        <Text label="Dのうち週20時間未満の有期契約労働者数" type="number" value={form.under20hFixedTermCount} onChange={(v) => set("under20hFixedTermCount", num(v))} />
      </Section>

      <Section title="労務管理・コンプライアンス">
        <Check label="労災保険加入" checked={form.hasLaborInsurance} onChange={(v) => set("hasLaborInsurance", v)} />
        <Check label="雇用保険加入" checked={form.hasEmploymentIns} onChange={(v) => set("hasEmploymentIns", v)} />
        <Check label="社会保険加入" checked={form.hasSocialInsurance} onChange={(v) => set("hasSocialInsurance", v)} />
        <div />
        <Select label="36協定の状況" value={form.agreement36Status} onChange={(v) => set("agreement36Status", v)} options={STATUS3} />
        <Text label="36協定の届出日（届出済みの場合・例：令和7年4月1日）" value={form.agreement36Date} onChange={(v) => set("agreement36Date", v)} />
        <Select label="就業規則の状況" value={form.workRulesStatus} onChange={(v) => set("workRulesStatus", v)} options={STATUS3} />
        <div />
        <Check label="賃金台帳整備" checked={form.hasWageLedger} onChange={(v) => set("hasWageLedger", v)} />
        <Check label="出勤簿整備" checked={form.hasAttendanceBook} onChange={(v) => set("hasAttendanceBook", v)} />
        <Check label="労働者名簿整備" checked={form.hasEmployeeRoster} onChange={(v) => set("hasEmployeeRoster", v)} />
        <div />
        <Select label="雇用契約書は労働者全員分あるか" value={form.employmentContractsStatus} onChange={(v) => set("employmentContractsStatus", v)} options={CONTRACTS} />
        <Text label="雇用契約書「その他」の内容" value={form.employmentContractsNote} onChange={(v) => set("employmentContractsNote", v)} />
      </Section>

      <Section title="就業規則がない場合の勤務条件（任意）">
        <Text label="勤務日" value={form.workDays} onChange={(v) => set("workDays", v)} />
        <Text label="休日" value={form.holidays} onChange={(v) => set("holidays", v)} />
        <Text label="休暇" value={form.vacations} onChange={(v) => set("vacations", v)} />
        <Text label="労働時間" value={form.workHours} onChange={(v) => set("workHours", v)} />
        <Text label="休憩" value={form.breakTime} onChange={(v) => set("breakTime", v)} />
        <div />
        <Text label="手当① 名称（例：通勤）" value={form.allowance1Name} onChange={(v) => set("allowance1Name", v)} />
        <Text label="手当① 月額（例：実費5,000まで）" value={form.allowance1Amount} onChange={(v) => set("allowance1Amount", v)} />
        <Text label="手当② 名称（例：資格）" value={form.allowance2Name} onChange={(v) => set("allowance2Name", v)} />
        <Text label="手当② 月額（例：10,000）" value={form.allowance2Amount} onChange={(v) => set("allowance2Amount", v)} />
        <Text label="手当③ 名称（例：皆勤）" value={form.allowance3Name} onChange={(v) => set("allowance3Name", v)} />
        <Text label="手当③ 月額（例：10,000）" value={form.allowance3Amount} onChange={(v) => set("allowance3Amount", v)} />
      </Section>

      <Section title="賃金">
        <Text label="締め日" value={form.payClosingDay} onChange={(v) => set("payClosingDay", v)} />
        <Text label="支給日" value={form.payDay} onChange={(v) => set("payDay", v)} />
        <Check label="昇給制度がある" checked={form.hasRaiseSystem} onChange={(v) => set("hasRaiseSystem", v)} />
        <Text label="昇給月（例：10月）" value={form.raiseMonth} onChange={(v) => set("raiseMonth", v)} />
        <Text label="賃上げ予定額（円）" type="number" value={form.plannedWageRaise} onChange={(v) => set("plannedWageRaise", num(v))} />
        <Text label="賃上げ予定人数" type="number" value={form.wageRaiseHeadcount} onChange={(v) => set("wageRaiseHeadcount", num(v))} />
      </Section>

      <Section title="定年・賞与・退職金">
        <Select label="定年制度" value={form.retirementSystem} onChange={(v) => set("retirementSystem", v)} options={RETIREMENT} />
        <div />
        <Check label="賞与がある" checked={form.hasBonus} onChange={(v) => set("hasBonus", v)} />
        <div />
        <Text label="夏季賞与（月）" value={form.bonusSummer} onChange={(v) => set("bonusSummer", v)} />
        <Text label="冬季賞与（月）" value={form.bonusWinter} onChange={(v) => set("bonusWinter", v)} />
        <Check label="退職金制度がある" checked={form.hasRetirementAllowance} onChange={(v) => set("hasRetirementAllowance", v)} />
      </Section>

      <Section title="設備投資情報">
        <Check label="設備導入予定あり" checked={form.willInvestEquipment} onChange={(v) => set("willInvestEquipment", v)} />
        <div />
        <Text label="設備名" value={form.equipmentName} onChange={(v) => set("equipmentName", v)} />
        <Text label="設備価格（円）" type="number" value={form.equipmentPrice} onChange={(v) => set("equipmentPrice", num(v))} />
        <Text label="購入先" value={form.equipmentVendor} onChange={(v) => set("equipmentVendor", v)} />
        <Text label="導入目的" value={form.equipmentPurpose} onChange={(v) => set("equipmentPurpose", v)} />
        <Text label="生産性向上効果" value={form.productivityEffect} onChange={(v) => set("productivityEffect", v)} />
      </Section>

      <Section title="正社員転換（キャリアアップ助成金）">
        <Text label="正社員転換予定人数" type="number" value={form.plannedConversions} onChange={(v) => set("plannedConversions", num(v))} />
        <Text label="うち重点支援対象者の人数（雇入れ3年以上の有期 等）" type="number" value={form.prioritySupportConversions} onChange={(v) => set("prioritySupportConversions", num(v))} />
        <Text label="転換予定日" type="date" value={form.conversionDate} onChange={(v) => set("conversionDate", v)} />
      </Section>

      <Section title="働き方改革：成果目標（1つ以上）">
        <Check label="成果目標① 時間外労働の削減" checked={form.hatarakiGoal1} onChange={(v) => set("hatarakiGoal1", v)} />
        <Select label="①の区分（削減前→後の時間外）" value={form.hatarakiGoal1Type} onChange={(v) => set("hatarakiGoal1Type", v)} options={GOAL1TYPES} placeholder="未選択" />
        <Check label="成果目標② 年次有給休暇の計画的付与制度を新規導入" checked={form.hatarakiGoal2} onChange={(v) => set("hatarakiGoal2", v)} />
        <Check label="成果目標③ 時間単位の年休＋特別休暇を新規導入" checked={form.hatarakiGoal3} onChange={(v) => set("hatarakiGoal3", v)} />
      </Section>

      <Section title="状況・不支給リスク確認">
        <Text label="過去に申請した助成金（自由記述）" value={form.pastSubsidies} onChange={(v) => set("pastSubsidies", v)} />
        <Select label="社労士との契約" value={form.sharoshiContract} onChange={(v) => set("sharoshiContract", v)} options={SHAROSHI} />
        <Text label="直近6か月の会社都合離職者数" type="number" value={form.companyReasonLeavers} onChange={(v) => set("companyReasonLeavers", num(v))} />
        <Text label="60歳以上の雇用保険加入者数" type="number" value={form.over60Insured} onChange={(v) => set("over60Insured", num(v))} />
        <Text label="50歳以上の有期契約労働者数" type="number" value={form.over50FixedTerm} onChange={(v) => set("over50FixedTerm", num(v))} />
        <div />
        <Check label="過去3年間、助成金の不正受給はない" checked={form.noFraudPast3y} onChange={(v) => set("noFraudPast3y", v)} />
        <Check label="過去1年間、労働関係法令の違反はない" checked={form.noLaborLawViolation} onChange={(v) => set("noLaborLawViolation", v)} />
      </Section>

      <Section title="取組予定（判定の補助情報）">
        <Check label="労働時間改善に取り組む予定" checked={form.willImproveWorktime} onChange={(v) => set("willImproveWorktime", v)} />
        <Check label="キャリアアップ計画の整備が可能" checked={form.canPrepareCareerPlan} onChange={(v) => set("canPrepareCareerPlan", v)} />
        <Check label="就業規則の改定が可能" checked={form.canReviseWorkRules} onChange={(v) => set("canReviseWorkRules", v)} />
      </Section>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "診断中..." : "診断する"}
      </button>
    </form>
  );
}
