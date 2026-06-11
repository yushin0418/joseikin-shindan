# 助成金診断システム

社会保険労務士事務所向けの助成金診断 Web システム。顧問先が入力した情報から、

- 業務改善助成金
- 働き方改革推進支援助成金
- キャリアアップ助成金（正社員化コース）

の対象可否（○／△／×）を自動判定し、**画面表示・PDF出力・メール送信**を行います。

> ⚠️ 判定の数値・条件は暫定の既定値です。助成金は毎年改正されるため、申請前に必ず最新の交付要領で確認し、`config/criteria.json` を更新してください。本システムは要領に明記されない事項を推測しません。

---

## 技術スタック

| 項目 | 採用 |
|---|---|
| 言語 / FW | TypeScript + Next.js 14（App Router） |
| UI | Tailwind CSS |
| DB | SQLite + Prisma |
| PDF | PDFKit |
| メール | Nodemailer |
| 認証 | 自前 JWT（jose）+ bcryptjs（HTTP-only Cookie） |
| バリデーション | zod |
| テスト | Vitest |

---

## 前提条件

- **Node.js 20 以上**（必須）。未導入の場合：
  - https://nodejs.org/ja から LTS をインストール、または `winget install OpenJS.NodeJS.LTS`
- Git（任意）

---

## セットアップ

```bash
# 1. 依存インストール
npm install

# 2. 環境変数
cp .env.example .env        # Windows: copy .env.example .env
#   AUTH_SECRET / ADMIN_EMAIL / ADMIN_PASSWORD / SMTP_* を必要に応じて編集

# 3. DB 初期化（マイグレーション + 管理者シード）
npx prisma migrate dev --name init
npm run prisma:seed

# 4. 開発起動
npm run dev
# http://localhost:3000
```

### 日本語PDFフォントの配置（重要）

PDFKit の標準フォントは日本語非対応です。`assets/fonts/NotoSansJP-Regular.ttf` を配置してください（手順は `assets/fonts/README.md`）。未配置の場合、PDFは生成されますが日本語が文字化けします。

---

## 使い方

### 顧問先（二次利用者）
1. トップ → 「診断を始める」 → `/diagnose`
2. 会社情報・労務・賃金・設備・雇用を入力して「診断する」
3. `/result/[id]` で総合ランク（A/B/C）と各助成金の判定（対象理由・不足要件・想定リスク・次のアクション・必要書類）を確認

### 社労士（一次利用者 / 管理画面）
1. `/admin/login` で管理者ログイン（seed で作成した `ADMIN_EMAIL` / `ADMIN_PASSWORD`）
2. `/admin` で診断一覧・会社名/ランク検索・CSV出力
3. 各行から「表示 / PDF / メール（PDF添付）」

---

## 判定条件の編集（法改正対応）

`config/criteria.json` を編集するだけで判定ロジックに反映されます（コード変更不要）。

```jsonc
{
  "version": "2025-04",
  "gyomukaizen": {
    "smeMaxRegularEmployeesByCategory": { "小売業": 50, "サービス業": 100, "卸売業": 100, "製造業その他": 300, "その他": 300 },
    "minWageGapYen": 50,            // 事業場内最賃 − 地域別最賃 の許容差
    "requireWageRaisePlan": true,
    "requireProductivityInvestment": true
  },
  "hatarakikata": { "require36Agreement": true, "requireWorktimeImprovement": true, "requireEquipmentInvestment": true },
  "careerUp": { "minWageIncreaseRate": 0.03, "requireFixedTermEmployee": true, "requireConversionPlan": true, "requireRulesRevision": true }
}
```

---

## ディレクトリ構成

```
config/criteria.json        判定条件（外出し設定）
prisma/schema.prisma        DB設計
prisma/seed.ts              管理者初期投入
src/lib/
  criteria.ts               設定読込
  diagnosis.ts              診断ロジック（純関数・テスト対象）
  validation.ts             zod スキーマ
  auth.ts / csrf.ts         認証・CSRF
  pdf.ts / mailer.ts        PDF / メール
  mapping.ts                DB→入力変換
src/app/
  diagnose/                 入力フォーム
  result/[id]/              結果表示
  admin/                    管理画面（login / 一覧）
  api/                      診断・認証・PDF・メール・CSV・CSRF
src/middleware.ts           /admin・管理API の認証ガード
tests/diagnosis.test.ts     診断ロジックの単体テスト
```

---

## API 一覧

| メソッド / パス | 役割 | 認証 |
|---|---|---|
| `GET /api/csrf` | CSRFトークン発行 | 公開 |
| `POST /api/diagnose` | 診断実行＋保存 | 公開（CSRF必須） |
| `GET /api/diagnoses` | 一覧・検索 | 管理者 |
| `GET /api/diagnoses/[id]` | 取得 | 管理者 |
| `DELETE /api/diagnoses/[id]` | 削除 | 管理者 |
| `GET /api/diagnoses/[id]/pdf` | PDF生成 | 管理者 |
| `POST /api/diagnoses/[id]/email` | メール送信（PDF添付） | 管理者（CSRF必須） |
| `GET /api/diagnoses/export` | CSV出力 | 管理者 |
| `POST /api/auth/login` `/logout` | 認証 | - |

---

## テスト

```bash
npm test
```

`tests/diagnosis.test.ts` が診断ロジック（○/△/×、境界値、設定ファイル駆動）を検証します。

---

## セキュリティ対策

- **入力値バリデーション**：zod（型・範囲・必須・enum）
- **SQLインジェクション**：Prisma（パラメタライズドクエリ）
- **XSS**：React 既定エスケープ ＋ CSV はインジェクション無害化
- **CSRF**：ダブルサブミットCookie（`x-csrf-token`）
- **認証**：bcrypt ハッシュ ＋ JWT を HTTP-only / SameSite Cookie、`middleware.ts` でガード
- **操作ログ**：`AuditLog`（login / logout / diagnose / pdf / email / csv）

---

## デプロイ

SQLite を使用するため、ファイルシステムが永続する常駐サーバ（VPS / オンプレ / コンテナ）を推奨します（Vercel のようなサーバレス環境では SQLite ファイルが永続しません。永続化する場合は PostgreSQL 等へ `datasource` を変更してください）。

```bash
npm install
cp .env.example .env   # 本番値に編集（AUTH_SECRET は十分長いランダム値に）
npx prisma migrate deploy
npm run prisma:seed
npm run build
npm start              # 既定 http://localhost:3000
```

PostgreSQL へ切り替える場合：`prisma/schema.prisma` の `provider` を `postgresql` に、`DATABASE_URL` を接続文字列に変更して `npx prisma migrate dev`。

---

## 注意（免責）

本システムの判定は申請可否を保証するものではありません。最終判断は最新の交付要領に基づき社会保険労務士が行ってください。
