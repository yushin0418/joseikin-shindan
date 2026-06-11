import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/** 一覧・検索（管理者）。?q=会社名 &rank=A|B|C */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const rank = req.nextUrl.searchParams.get("rank")?.trim();

  const where: Prisma.DiagnosisResultWhereInput = {};
  if (rank && ["A", "B", "C"].includes(rank)) {
    where.overallRank = rank;
  }
  if (q) {
    where.diagnosis = { companyName: { contains: q } };
  }

  const rows = await prisma.diagnosisResult.findMany({
    where,
    include: { diagnosis: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const data = rows.map((r) => ({
    id: r.diagnosisId,
    companyName: r.diagnosis.companyName,
    contactEmail: r.diagnosis.contactEmail ?? "",
    createdAt: r.createdAt,
    overallRank: r.overallRank,
    eligibleCount: r.eligibleCount,
  }));

  return NextResponse.json({ data });
}
