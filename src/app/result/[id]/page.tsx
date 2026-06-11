import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ResultView } from "@/components/ResultView";
import type { DiagnosisResult } from "@/lib/diagnosis";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
}: {
  params: { id: string };
}) {
  const record = await prisma.diagnosisResult.findUnique({
    where: { diagnosisId: params.id },
    include: { diagnosis: true },
  });

  if (!record) notFound();

  const result = JSON.parse(record.resultJson) as DiagnosisResult;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">助成金診断結果</h1>
          <p className="mt-1 text-sm text-slate-500">
            {record.diagnosis.companyName} ／ 診断日時：
            {new Date(record.createdAt).toLocaleString("ja-JP")}
          </p>
        </div>
        <a
          href="/diagnose"
          className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          別の診断を行う
        </a>
      </div>

      <ResultView result={result} />
    </div>
  );
}
