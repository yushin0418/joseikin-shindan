import { cookies } from "next/headers";
import { CSRF_COOKIE } from "./auth";

/**
 * ダブルサブミットCookie方式のCSRF対策。
 * - 発行: ランダムトークンを Cookie(非httpOnly) に保存し、画面にも埋め込む
 * - 検証: リクエストヘッダ x-csrf-token と Cookie 値が一致するか確認
 */
export function issueCsrfToken(): string {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  cookies().set(CSRF_COOKIE, token, {
    httpOnly: false, // フロントから読めるようにする（ダブルサブミット）
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return token;
}

export function getCsrfCookie(): string | undefined {
  return cookies().get(CSRF_COOKIE)?.value;
}

/** Route Handler 内での検証（リクエストヘッダ値とCookie値を突き合わせ） */
export function verifyCsrf(headerToken: string | null): boolean {
  const cookieToken = getCsrfCookie();
  if (!cookieToken || !headerToken) return false;
  // タイミング差を避けるための単純比較（長さ一致前提）
  if (cookieToken.length !== headerToken.length) return false;
  let mismatch = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    mismatch |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }
  return mismatch === 0;
}
