import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** 単一診断の取得（管理者） */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const record = await prisma.diagnosisResult.findUnique({
    where: { diagnosisId: params.id },
    include: { diagnosis: true },
  });
  if (!record) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }
  return NextResponse.json({
    diagnosis: record.diagnosis,
    result: JSON.parse(record.resultJson),
    createdAt: record.createdAt,
  });
}

/** 削除（管理者） */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.diagnosis.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
