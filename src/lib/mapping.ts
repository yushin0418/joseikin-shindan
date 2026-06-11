import type { Diagnosis } from "@prisma/client";
import type { DiagnosisInput } from "./validation";

/** Prisma の Diagnosis レコードを診断/PDF用の入力オブジェクトへ変換 */
export function toDiagnosisInput(d: Diagnosis): DiagnosisInput {
  return {
    companyName: d.companyName,
    corporateNumber: d.corporateNumber ?? "",
    address: d.address,
    industry: d.industry,
    industryCategory: d.industryCategory as DiagnosisInput["industryCategory"],
    orgType: d.orgType as DiagnosisInput["orgType"],
    contactName: d.contactName ?? "",
    contactTel: d.contactTel ?? "",
    contactEmail: d.contactEmail ?? "",
    hasBranch: d.hasBranch,
    branchNote: d.branchNote ?? "",

    employeeCount: d.employeeCount,
    regularStaffCount: d.regularStaffCount,
    permanentInsuredCount: d.permanentInsuredCount,
    fixedTermInsuredCount: d.fixedTermInsuredCount,
    under20hUninsuredCount: d.under20hUninsuredCount,
    under20hFixedTermCount: d.under20hFixedTermCount,
    inHouseMinWage: d.inHouseMinWage,

    hasLaborInsurance: d.hasLaborInsurance,
    hasEmploymentIns: d.hasEmploymentIns,
    hasSocialInsurance: d.hasSocialInsurance,
    agreement36Status: d.agreement36Status as DiagnosisInput["agreement36Status"],
    agreement36Date: d.agreement36Date ?? "",
    workRulesStatus: d.workRulesStatus as DiagnosisInput["workRulesStatus"],
    hasWageLedger: d.hasWageLedger,
    hasAttendanceBook: d.hasAttendanceBook,
    hasEmployeeRoster: d.hasEmployeeRoster,
    employmentContractsStatus: d.employmentContractsStatus as DiagnosisInput["employmentContractsStatus"],
    employmentContractsNote: d.employmentContractsNote ?? "",

    workDays: d.workDays ?? "",
    holidays: d.holidays ?? "",
    vacations: d.vacations ?? "",
    workHours: d.workHours ?? "",
    breakTime: d.breakTime ?? "",
    allowance1Name: d.allowance1Name ?? "",
    allowance1Amount: d.allowance1Amount ?? "",
    allowance2Name: d.allowance2Name ?? "",
    allowance2Amount: d.allowance2Amount ?? "",
    allowance3Name: d.allowance3Name ?? "",
    allowance3Amount: d.allowance3Amount ?? "",

    payClosingDay: d.payClosingDay ?? "",
    payDay: d.payDay ?? "",
    hasRaiseSystem: d.hasRaiseSystem,
    raiseMonth: d.raiseMonth ?? "",
    plannedWageRaise: d.plannedWageRaise,
    wageRaiseHeadcount: d.wageRaiseHeadcount,

    retirementSystem: (d.retirementSystem ?? "") as DiagnosisInput["retirementSystem"],
    hasBonus: d.hasBonus,
    bonusSummer: d.bonusSummer ?? "",
    bonusWinter: d.bonusWinter ?? "",
    hasRetirementAllowance: d.hasRetirementAllowance,

    willInvestEquipment: d.willInvestEquipment,
    equipmentName: d.equipmentName ?? "",
    equipmentPrice: d.equipmentPrice ?? 0,
    equipmentVendor: d.equipmentVendor ?? "",
    equipmentPurpose: d.equipmentPurpose ?? "",
    productivityEffect: d.productivityEffect ?? "",

    plannedConversions: d.plannedConversions,
    conversionDate: d.conversionDate ?? "",

    pastSubsidies: d.pastSubsidies ?? "",
    sharoshiContract: d.sharoshiContract as DiagnosisInput["sharoshiContract"],
    companyReasonLeavers: d.companyReasonLeavers,
    over60Insured: d.over60Insured,
    over50FixedTerm: d.over50FixedTerm,
    noFraudPast3y: d.noFraudPast3y,
    noLaborLawViolation: d.noLaborLawViolation,

    willImproveWorktime: d.willImproveWorktime,
    canPrepareCareerPlan: d.canPrepareCareerPlan,
    canReviseWorkRules: d.canReviseWorkRules,
  };
}
