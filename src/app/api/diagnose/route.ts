import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diagnosisInputSchema } from "@/lib/validation";
import { runDiagnosis } from "@/lib/diagnosis";
import { verifyCsrf } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // CSRF 検証（ダブルサブミット）
  if (!verifyCsrf(req.headers.get("x-csrf-token"))) {
    return NextResponse.json({ error: "CSRFトークンが不正です" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const parsed = diagnosisInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力値が不正です", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;
  const result = runDiagnosis(input);

  const saved = await prisma.diagnosis.create({
    data: {
      companyName: input.companyName,
      corporateNumber: input.corporateNumber || null,
      address: input.address,
      industry: input.industry,
      industryCategory: input.industryCategory,
      orgType: input.orgType,
      contactName: input.contactName || null,
      contactTel: input.contactTel || null,
      contactEmail: input.contactEmail || null,
      hasBranch: input.hasBranch,
      branchNote: input.branchNote || null,

      employeeCount: input.employeeCount,
      regularStaffCount: input.regularStaffCount,
      permanentInsuredCount: input.permanentInsuredCount,
      fixedTermInsuredCount: input.fixedTermInsuredCount,
      under20hUninsuredCount: input.under20hUninsuredCount,
      under20hFixedTermCount: input.under20hFixedTermCount,
      inHouseMinWage: input.inHouseMinWage,

      hasLaborInsurance: input.hasLaborInsurance,
      hasEmploymentIns: input.hasEmploymentIns,
      hasSocialInsurance: input.hasSocialInsurance,
      agreement36Status: input.agreement36Status,
      agreement36Date: input.agreement36Date || null,
      workRulesStatus: input.workRulesStatus,
      hasWageLedger: input.hasWageLedger,
      hasAttendanceBook: input.hasAttendanceBook,
      hasEmployeeRoster: input.hasEmployeeRoster,
      employmentContractsStatus: input.employmentContractsStatus,
      employmentContractsNote: input.employmentContractsNote || null,

      workDays: input.workDays || null,
      holidays: input.holidays || null,
      vacations: input.vacations || null,
      workHours: input.workHours || null,
      breakTime: input.breakTime || null,
      allowance1Name: input.allowance1Name || null,
      allowance1Amount: input.allowance1Amount || null,
      allowance2Name: input.allowance2Name || null,
      allowance2Amount: input.allowance2Amount || null,
      allowance3Name: input.allowance3Name || null,
      allowance3Amount: input.allowance3Amount || null,

      payClosingDay: input.payClosingDay || null,
      payDay: input.payDay || null,
      hasRaiseSystem: input.hasRaiseSystem,
      raiseMonth: input.raiseMonth || null,
      plannedWageRaise: input.plannedWageRaise,
      wageRaiseHeadcount: input.wageRaiseHeadcount,

      retirementSystem: input.retirementSystem || null,
      hasBonus: input.hasBonus,
      bonusSummer: input.bonusSummer || null,
      bonusWinter: input.bonusWinter || null,
      hasRetirementAllowance: input.hasRetirementAllowance,

      willInvestEquipment: input.willInvestEquipment,
      equipmentName: input.equipmentName || null,
      equipmentPrice: input.equipmentPrice ?? null,
      equipmentVendor: input.equipmentVendor || null,
      equipmentPurpose: input.equipmentPurpose || null,
      productivityEffect: input.productivityEffect || null,

      plannedConversions: input.plannedConversions,
      conversionDate: input.conversionDate || null,

      pastSubsidies: input.pastSubsidies || null,
      sharoshiContract: input.sharoshiContract,
      companyReasonLeavers: input.companyReasonLeavers,
      over60Insured: input.over60Insured,
      over50FixedTerm: input.over50FixedTerm,
      noFraudPast3y: input.noFraudPast3y,
      noLaborLawViolation: input.noLaborLawViolation,

      willImproveWorktime: input.willImproveWorktime,
      canPrepareCareerPlan: input.canPrepareCareerPlan,
      canReviseWorkRules: input.canReviseWorkRules,

      result: {
        create: {
          overallRank: result.overallRank,
          eligibleCount: result.eligibleCount,
          resultJson: JSON.stringify(result),
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: "guest",
      action: "diagnose",
      targetId: saved.id,
      ip: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  return NextResponse.json({ id: saved.id, result });
}
