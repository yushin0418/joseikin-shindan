import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  clearSessionCookie();
  if (session) {
    await prisma.auditLog.create({
      data: { actor: session.email, action: "logout" },
    });
  }
  return NextResponse.json({ ok: true });
}
