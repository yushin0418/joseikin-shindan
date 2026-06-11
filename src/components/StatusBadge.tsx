import type { Status } from "@/lib/diagnosis";

const MAP: Record<Status, { text: string; cls: string }> = {
  "○": { text: "○ 対象可能性高い", cls: "bg-green-100 text-green-800 border-green-300" },
  "△": { text: "△ 要件確認必要", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  "×": { text: "× 対象外", cls: "bg-red-100 text-red-800 border-red-300" },
};

export function StatusBadge({ status }: { status: Status }) {
  const m = MAP[status];
  return (
    <span className={`inline-block rounded border px-2.5 py-1 text-sm font-semibold ${m.cls}`}>
      {m.text}
    </span>
  );
}

const RANK: Record<string, { cls: string }> = {
  A: { cls: "bg-green-600" },
  B: { cls: "bg-amber-500" },
  C: { cls: "bg-red-600" },
};

export function RankBadge({ rank, label }: { rank: string; label: string }) {
  const r = RANK[rank] ?? RANK.C;
  return (
    <span className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-white ${r.cls}`}>
      <span className="text-lg font-bold">{rank}ランク</span>
      <span className="text-sm">{label}</span>
    </span>
  );
}
