import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReportPdf } from "@/lib/pdf";
import { sendDiagnosisMail } from "@/lib/mailer";
import { toDiagnosisInput } from "@/lib/mapping";
import { getSession } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { z } from "zod";
import type { DiagnosisResult } from "@/lib/diagnosis";

export const dynamic = "force-dynamic";

// to を省略した場合は、診断時に入力されたメールアドレスへ送信する
const bodySchema = z.object({
  to: z.string().email("送信先メールの形式が不正です").optional().or(z.literal("")),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!verifyCsrf(req.headers.get("x-csrf-token"))) {
    return NextResponse.json({ error: "CSRFトークンが不正です" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "送信先メールが不正です" }, { status: 422 });
  }

  const record = await prisma.diagnosisResult.findUnique({
    where: { diagnosisId: params.id },
    include: { diagnosis: true },
  });
  if (!record) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  // 宛先：指定があればそれを優先、なければ診断時に入力されたメールアドレス
  const to = parsed.data.to || record.diagnosis.contactEmail || "";
  if (!to) {
    return NextResponse.json(
      { error: "送信先メールアドレスがありません（診断時に未入力のため、宛先を指定してください）" },
      { status: 422 },
    );
  }

  const input = toDiagnosisInput(record.diagnosis);
  const result = JSON.parse(record.resultJson) as DiagnosisResult;
  const pdf = await generateReportPdf(input, result, new Date(record.createdAt));
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const sent = await sendDiagnosisMail({
    to,
    companyName: record.diagnosis.companyName,
    result,
    pdf,
    resultUrl: `${base}/result/${params.id}`,
  });

  const session = await getSession();
  await prisma.auditLog.create({
    data: { actor: session?.email ?? "unknown", action: "email", targetId: params.id },
  });

  return NextResponse.json({ ok: true, previewUrl: sent.previewUrl });
}
