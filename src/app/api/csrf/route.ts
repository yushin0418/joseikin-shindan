import { NextResponse } from "next/server";
import { issueCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

/** CSRFトークンを発行（Cookie + レスポンスボディのダブルサブミット） */
export async function GET() {
  const token = issueCsrfToken();
  return NextResponse.json({ token });
}
