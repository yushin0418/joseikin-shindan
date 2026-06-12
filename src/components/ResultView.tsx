import type { DiagnosisResult, GrantResult } from "@/lib/diagnosis";
import { RankBadge, StatusBadge } from "./StatusBadge";

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <h4 className={`text-sm font-semibold ${tone}`}>{title}</h4>
      {items.length === 0 ? (
        <p className="pl-4 text-sm text-slate-400">該当なし</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-6 text-sm text-slate-700">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GrantCard({ g }: { g: GrantResult }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{g.label}</h3>
        <StatusBadge status={g.status} />
      </div>
      {g.estimatedAmount && (
        <div className="mt-3 rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          <span className="font-semibold">想定助成額：</span>
          {g.estimatedAmount}
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <List title="対象理由" items={g.reasons} tone="text-green-700" />
        <List title="不足要件" items={g.shortfalls} tone="text-amber-700" />
        <List title="想定リスク" items={g.risks} tone="text-red-700" />
        <List title="次のアクション" items={g.actions} tone="text-brand" />
      </div>
      <div className="mt-4">
        <List title="必要書類" items={g.requiredDocs} tone="text-slate-600" />
      </div>
      {g.source && (
        <p className="mt-3 text-xs text-slate-400">出典：{g.source}</p>
      )}
    </div>
  );
}

export function ResultView({ result }: { result: DiagnosisResult }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">総合評価</h2>
        <div className="mt-3">
          <RankBadge rank={result.overallRank} label={result.overallLabel} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          対象可能性（○）：{result.eligibleCount}件 ／ 判定条件バージョン：{result.criteriaVersion}
        </p>
      </div>

      {result.grants.map((g) => (
        <GrantCard key={g.key} g={g} />
      ))}

      <p className="text-xs text-slate-400">※ {result.disclaimer}</p>
    </div>
  );
}
