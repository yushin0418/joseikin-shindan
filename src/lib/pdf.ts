import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { DiagnosisResult, GrantResult } from "./diagnosis";
import type { DiagnosisInput } from "./validation";

const STATUS_COLOR: Record<string, string> = {
  "○": "#15803d",
  "△": "#b45309",
  "×": "#b91c1c",
};

function resolveFontPath(): string | null {
  const configured = process.env.PDF_FONT_PATH ?? "assets/fonts/NotoSansJP-Regular.ttf";
  const abs = path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
  return fs.existsSync(abs) ? abs : null;
}

/** 診断結果PDF（タイトル「助成金診断レポート」）をバッファで返す */
export function generateReportPdf(
  input: DiagnosisInput,
  result: DiagnosisResult,
  createdAt: Date,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // 日本語フォント登録（未配置なら標準フォントにフォールバック）
      const fontPath = resolveFontPath();
      const FONT = "JP";
      if (fontPath) {
        doc.registerFont(FONT, fontPath);
        doc.font(FONT);
      } else {
        console.warn(
          "[pdf] 日本語フォントが見つかりません。PDF_FONT_PATH を確認してください。日本語は文字化けします。",
        );
      }

      const useFont = () => (fontPath ? doc.font(FONT) : doc);

      // タイトル
      useFont().fontSize(20).fillColor("#111827").text("助成金診断レポート", { align: "center" });
      doc.moveDown(0.3);
      useFont()
        .fontSize(10)
        .fillColor("#6b7280")
        .text(`診断日時：${formatDate(createdAt)}　／　判定条件バージョン：${result.criteriaVersion}`, {
          align: "center",
        });
      doc.moveDown(1);

      // 会社情報
      sectionTitle(doc, useFont, "会社情報");
      kv(doc, useFont, [
        ["会社名", input.companyName],
        ["法人番号", input.corporateNumber || "（未記入）"],
        ["所在地", input.address],
        ["業種", `${input.industry}（区分：${input.industryCategory}）`],
        ["法人／個人", input.orgType],
        ["ご担当者", `${input.contactName || "（未記入）"}　${input.contactTel || ""}`],
        ["メールアドレス", input.contactEmail || "（未記入）"],
        ["従業員数", `${input.employeeCount}名`],
        ["会社内の最低賃金", `${input.inHouseMinWage.toLocaleString()}円`],
      ]);
      doc.moveDown(0.5);

      // 総合評価
      sectionTitle(doc, useFont, "総合評価");
      useFont()
        .fontSize(14)
        .fillColor(rankColor(result.overallRank))
        .text(`${result.overallRank}ランク：${result.overallLabel}　（対象可能性○：${result.eligibleCount}件）`);
      doc.moveDown(0.8);

      // 各助成金
      result.grants.forEach((g) => grantBlock(doc, useFont, g));

      // 社労士への相談事項（全助成金のアクションを集約）
      sectionTitle(doc, useFont, "社労士への相談事項");
      const consult = Array.from(
        new Set(result.grants.flatMap((g) => g.actions)),
      );
      bullet(doc, useFont, consult);
      doc.moveDown(0.5);

      // 免責
      useFont()
        .fontSize(8)
        .fillColor("#9ca3af")
        .text(`※ ${result.disclaimer}`, { align: "left" });

      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}

function grantBlock(
  doc: PDFKit.PDFDocument,
  useFont: () => PDFKit.PDFDocument,
  g: GrantResult,
) {
  // 改ページ余裕がなければ改ページ
  if (doc.y > 680) doc.addPage();

  useFont()
    .fontSize(13)
    .fillColor("#111827")
    .text(`■ ${g.label}　判定：`, { continued: true });
  useFont().fillColor(STATUS_COLOR[g.status] ?? "#111827").text(g.status);
  doc.moveDown(0.2);

  labeledList(doc, useFont, "対象理由", g.reasons, "#374151");
  labeledList(doc, useFont, "不足要件", g.shortfalls, "#374151");
  labeledList(doc, useFont, "想定リスク", g.risks, "#374151");
  labeledList(doc, useFont, "必要書類", g.requiredDocs, "#374151");
  doc.moveDown(0.6);
}

function labeledList(
  doc: PDFKit.PDFDocument,
  useFont: () => PDFKit.PDFDocument,
  label: string,
  items: string[],
  color: string,
) {
  useFont().fontSize(10).fillColor("#1f2937").text(`【${label}】`);
  if (items.length === 0) {
    useFont().fontSize(9).fillColor("#9ca3af").text("　・該当なし");
  } else {
    items.forEach((it) =>
      useFont().fontSize(9).fillColor(color).text(`　・${it}`, { width: 495 }),
    );
  }
  doc.moveDown(0.2);
}

function sectionTitle(
  doc: PDFKit.PDFDocument,
  useFont: () => PDFKit.PDFDocument,
  title: string,
) {
  useFont().fontSize(12).fillColor("#1d4ed8").text(title);
  doc
    .moveTo(50, doc.y + 1)
    .lineTo(545, doc.y + 1)
    .strokeColor("#bfdbfe")
    .stroke();
  doc.moveDown(0.4);
}

function kv(
  doc: PDFKit.PDFDocument,
  useFont: () => PDFKit.PDFDocument,
  rows: [string, string][],
) {
  rows.forEach(([k, v]) => {
    useFont().fontSize(10).fillColor("#6b7280").text(`${k}：`, { continued: true });
    useFont().fillColor("#111827").text(v);
  });
}

function bullet(
  doc: PDFKit.PDFDocument,
  useFont: () => PDFKit.PDFDocument,
  items: string[],
) {
  if (items.length === 0) {
    useFont().fontSize(9).fillColor("#9ca3af").text("　・特になし");
    return;
  }
  items.forEach((it) =>
    useFont().fontSize(9).fillColor("#374151").text(`　・${it}`, { width: 495 }),
  );
}

function rankColor(rank: string): string {
  if (rank === "A") return "#15803d";
  if (rank === "B") return "#b45309";
  return "#b91c1c";
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
