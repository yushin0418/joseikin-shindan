import nodemailer from "nodemailer";
import type { DiagnosisResult } from "./diagnosis";

export interface SendResult {
  messageId: string;
  previewUrl: string | null; // Ethereal 利用時のプレビューURL
}

async function createTransport(): Promise<nodemailer.Transporter> {
  const host = process.env.SMTP_HOST;
  if (host) {
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }
  // SMTP 未設定時は開発用 Ethereal アカウントを生成（実送信されずプレビューURLのみ）
  const testAccount = await nodemailer.createTestAccount();
  console.warn(
    "[mailer] SMTP_HOST 未設定のため Ethereal テストアカウントを使用します（実際には届きません）。",
  );
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

function buildBody(
  companyName: string,
  result: DiagnosisResult,
  resultUrl: string,
): string {
  const eligible = result.grants
    .filter((g) => g.status === "○")
    .map((g) => `・${g.label}`)
    .join("\n");
  const triangle = result.grants
    .filter((g) => g.status === "△")
    .map((g) => `・${g.label}（要件整備後）`)
    .join("\n");

  const booking = process.env.BOOKING_URL ?? "（担当社労士までご連絡ください）";

  return [
    `${companyName} ご担当者さま`,
    "",
    "助成金診断の結果をお知らせします。詳細は添付のPDFレポートをご確認ください。",
    "",
    "■ 総合評価",
    `${result.overallRank}ランク：${result.overallLabel}`,
    "",
    "■ 対象可能性の高い助成金（○）",
    eligible || "（現時点で○の助成金はありません）",
    triangle ? "\n■ 要件整備で対象になり得る助成金（△）\n" + triangle : "",
    "",
    "■ 診断結果（画面）",
    resultUrl,
    "",
    "■ ご相談予約",
    `下記より無料相談をご予約いただけます。\n${booking}`,
    "",
    "----",
    `※ ${result.disclaimer}`,
  ].join("\n");
}

export async function sendDiagnosisMail(params: {
  to: string;
  companyName: string;
  result: DiagnosisResult;
  pdf: Buffer;
  resultUrl: string;
}): Promise<SendResult> {
  const transporter = await createTransport();
  const from = process.env.MAIL_FROM ?? "助成金診断システム <noreply@example.com>";

  const info = await transporter.sendMail({
    from,
    to: params.to,
    subject: "助成金診断結果のお知らせ",
    text: buildBody(params.companyName, params.result, params.resultUrl),
    attachments: [
      {
        filename: "助成金診断レポート.pdf",
        content: params.pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return {
    messageId: info.messageId,
    previewUrl: (nodemailer.getTestMessageUrl(info) as string) || null,
  };
}
