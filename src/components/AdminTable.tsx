"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  companyName: string;
  contactEmail: string;
  createdAt: string;
  overallRank: string;
  eligibleCount: number;
};

const RANK_CLS: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-amber-100 text-amber-800",
  C: "bg-red-100 text-red-800",
};

export function AdminTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [rank, setRank] = useState("");
  const [csrf, setCsrf] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (rank) params.set("rank", rank);
    const res = await fetch(`/api/diagnoses?${params.toString()}`);
    const d = await res.json();
    setRows(d.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/csrf").then((r) => r.json()).then((d) => setCsrf(d.token));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendEmail(id: string, company: string, savedEmail: string) {
    // 診断時に入力されたメールアドレスを初期値として表示（変更も可能）
    const to = window.prompt(
      `「${company}」の診断結果を送信するメールアドレス`,
      savedEmail,
    );
    if (!to) return;
    const res = await fetch(`/api/diagnoses/${id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ to }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      window.alert(
        d.previewUrl
          ? `送信しました（開発用プレビュー）：\n${d.previewUrl}`
          : "メールを送信しました。",
      );
    } else {
      window.alert(`送信失敗：${d.error ?? "エラー"}`);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-slate-600">会社名で検索</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600">総合ランク</span>
            <select
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-3 py-1.5"
            >
              <option value="">すべて</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>
          <button
            onClick={load}
            className="rounded bg-brand px-4 py-1.5 text-white hover:bg-brand-dark"
          >
            検索
          </button>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/diagnoses/export"
            className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            CSV出力
          </a>
          <button
            onClick={logout}
            className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ログアウト
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">会社名</th>
              <th className="px-4 py-2">診断日時</th>
              <th className="px-4 py-2">総合評価</th>
              <th className="px-4 py-2">対象数</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  読み込み中...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  該当する診断はありません
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">{r.companyName}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(r.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${RANK_CLS[r.overallRank] ?? ""}`}>
                      {r.overallRank}ランク
                    </span>
                  </td>
                  <td className="px-4 py-2">{r.eligibleCount}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <a href={`/result/${r.id}`} className="text-brand hover:underline">
                        表示
                      </a>
                      <a href={`/api/diagnoses/${r.id}/pdf`} className="text-brand hover:underline">
                        PDF
                      </a>
                      <button
                        onClick={() => sendEmail(r.id, r.companyName, r.contactEmail)}
                        className="text-brand hover:underline"
                      >
                        メール
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
