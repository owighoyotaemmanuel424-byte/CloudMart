import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const wallet = await db.wallet.findUnique({ where: { userId: user.id }, select: { currency: true, balanceMinor: true, updatedAt: true } });
  return NextResponse.json({ ok: true, wallet: wallet ? { ...wallet, balanceMinor: wallet.balanceMinor.toString() } : { currency: "NGN", balanceMinor: "0" } });
}
