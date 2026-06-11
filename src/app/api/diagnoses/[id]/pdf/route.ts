import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReportPdf } from "@/lib/pdf";
import { getSession } from "@/lib/auth";
import { toDiagnosisInput } from "@/lib/mapping";
import type { DiagnosisResult } from "@/lib/diagnosis";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const record = await prisma.diagnosisResult.findUnique({
    where: { diagnosisId: params.id },
    include: { diagnosis: true },
  });
  if (!record) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const input = toDiagnosisInput(record.diagnosis);
  const result = JSON.parse(record.resultJson) as DiagnosisResult;
  const pdf = await generateReportPdf(input, result, new Date(record.createdAt));

  const session = await getSession();
  await prisma.auditLog.create({
    data: { actor: session?.email ?? "unknown", action: "pdf", targetId: params.id },
  });

  const filename = encodeURIComponent(`助成金診断レポート_${record.diagnosis.companyName}.pdf`);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
