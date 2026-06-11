export default function Home() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          助成金診断システム
        </h1>
        <p className="mt-3 text-slate-600">
          顧問先企業の情報を入力すると、以下の助成金の対象可否を自動判定し、診断レポート（画面・PDF・メール）を作成します。
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-6 text-slate-700">
          <li>業務改善助成金</li>
          <li>働き方改革推進支援助成金</li>
          <li>キャリアアップ助成金（正社員化コース）</li>
        </ul>
        <div className="mt-6 flex gap-3">
          <a
            href="/diagnose"
            className="rounded bg-brand px-5 py-2.5 text-white hover:bg-brand-dark"
          >
            診断を始める
          </a>
          <a
            href="/admin"
            className="rounded border border-slate-300 px-5 py-2.5 text-slate-700 hover:bg-slate-50"
          >
            管理画面（社労士向け）
          </a>
        </div>
      </section>
    </div>
  );
}
