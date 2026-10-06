import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const wallet = await db.wallet.findUnique({
    where: { userId },
    select: { currency: true, balanceMinor: true, updatedAt: true },
  });

  return NextResponse.json({
    ok: true,
    wallet: wallet ? { ...wallet, balanceMinor: wallet.balanceMinor.toString() } : { currency: "NGN", balanceMinor: "0" },
  });
}
