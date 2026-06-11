import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 422 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { email } });
  // ユーザー不在でも同じメッセージ（列挙攻撃対策）
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが違います" },
      { status: 401 },
    );
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
  });
  setSessionCookie(token);

  await prisma.auditLog.create({
    data: {
      actor: user.email,
      action: "login",
      ip: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
