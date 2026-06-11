import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "助成金診断システム",
  description: "顧問先企業の情報から対象助成金を自動判定します",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <header className="bg-brand text-white shadow">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-bold text-lg">
              助成金診断システム
            </a>
            <nav className="text-sm space-x-4">
              <a href="/diagnose" className="hover:underline">
                診断する
              </a>
              <a href="/admin" className="hover:underline">
                管理画面
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-6 text-xs text-slate-400">
          ※ 判定結果は暫定であり、申請可否は最新の交付要領に基づき社労士が確認します。
        </footer>
      </body>
    </html>
  );
}
