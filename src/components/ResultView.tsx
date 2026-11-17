import type { DiagnosisResult, GrantResult } from "@/lib/diagnosis";
import { DEFAULT_WARN_DAYS, deadlineInfo } from "@/lib/deadline";
import type { DeadlineState } from "@/lib/deadline";
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

const DEADLINE_STYLE: Record<DeadlineState, string> = {
  ok: "border-slate-200 bg-slate-50 text-slate-700",
  soon: "border-amber-300 bg-amber-50 text-amber-900",
  today: "border-red-300 bg-red-50 text-red-800",
  passed: "border-red-300 bg-red-50 text-red-800",
};

/** 期限は日付だけ保存してあるので、表示のたびに「あと◯日」を計算する */
function Deadlines({ g, warnDays }: { g: GrantResult; warnDays: number }) {
  if (!g.deadlines || g.deadlines.length === 0) return null;
  const now = new Date();
  return (
    <div className="mt-3 space-y-1">
      {g.deadlines.map((d) => {
        const info = deadlineInfo(d, now, warnDays);
        return (
          <div key={d.key} className={`rounded border px-4 py-2 text-sm ${DEADLINE_STYLE[info.state]}`}>
            <span className="font-semibold">{info.text}</span>
            {d.blocksApplication && info.state === "passed" && (
              <span className="ml-2">（この診断結果は診断時点のもので、現在は申請できない可能性があります）</span>
            )}
            {d.note && <span className="mt-0.5 block text-xs opacity-80">{d.note}</span>}
          </div>
        );
      })}
    </div>
  );
}

function GrantCard({ g, warnDays }: { g: GrantResult; warnDays: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{g.label}</h3>
        <StatusBadge status={g.status} />
      </div>
      <Deadlines g={g} warnDays={warnDays} />
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
        <GrantCard key={g.key} g={g} warnDays={result.deadlineWarnDays ?? DEFAULT_WARN_DAYS} />
      ))}

      <p className="text-xs text-slate-400">※ {result.disclaimer}</p>
    </div>
  );
}
