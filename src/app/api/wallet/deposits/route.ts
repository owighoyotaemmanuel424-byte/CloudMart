import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const deposits = await db.walletDeposit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      amountMinor: true,
      currency: true,
      reference: true,
      status: true,
      paymentProvider: true,
      providerReference: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    deposits: deposits.map((deposit) => ({
      ...deposit,
      amountMinor: deposit.amountMinor.toString(),
    })),
  }, { headers: { "cache-control": "private, no-store" } });
}
