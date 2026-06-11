import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** CSV をエスケープ（XSS/CSVインジェクション対策含む） */
function csvCell(value: string | number): string {
  let s = String(value ?? "");
  // 先頭が式扱いされる文字なら無害化（CSVインジェクション対策）
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  // ダブルクオート・改行・カンマを含む場合はクオート
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: NextRequest) {
  const rows = await prisma.diagnosisResult.findMany({
    include: { diagnosis: true },
    orderBy: { createdAt: "desc" },
  });

  const header = ["診断ID", "会社名", "業種", "総合ランク", "対象数", "診断日時"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.diagnosisId,
        r.diagnosis.companyName,
        r.diagnosis.industry,
        r.overallRank,
        r.eligibleCount,
        new Date(r.createdAt).toLocaleString("ja-JP"),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // Excel互換のため BOM 付与
  const csv = "﻿" + lines.join("\r\n");

  const session = await getSession();
  await prisma.auditLog.create({
    data: { actor: session?.email ?? "unknown", action: "csv" },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("診断一覧.csv")}`,
    },
  });
}
