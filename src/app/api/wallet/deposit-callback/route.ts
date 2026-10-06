import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";

export async function GET(request: Request) {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user) return NextResponse.redirect(new URL("/dashboard?deposit=unauthorized", request.url));

  const reference = new URL(request.url).searchParams.get("reference")?.trim();
  if (!reference) return NextResponse.redirect(new URL("/dashboard?deposit=missing_reference", request.url));

  const deposit = await db.walletDeposit.findUnique({ where: { reference } });
  if (!deposit || deposit.userId !== user.id) {
    return NextResponse.redirect(new URL("/dashboard?deposit=not_found", request.url));
  }

  if (deposit.status === "CREDITED") {
    return NextResponse.redirect(new URL(`/dashboard?deposit=credited&reference=${encodeURIComponent(reference)}`, request.url));
  }

  try {
    const verified = await verifyPaystackTransaction(reference);
    const tx = verified.data;
    const amount = BigInt(tx.amount);
    if (tx.status !== "success" || tx.currency !== "NGN" || amount !== deposit.amountMinor) {
      await db.walletDeposit.update({ where: { id: deposit.id }, data: { status: tx.status === "failed" ? "FAILED" : "PENDING" } });
      return NextResponse.redirect(new URL(`/dashboard?deposit=${tx.status === "failed" ? "failed" : "pending"}&reference=${encodeURIComponent(reference)}`, request.url));
    }

    await db.$transaction(async (txdb) => {
      const current = await txdb.walletDeposit.findUnique({ where: { id: deposit.id } });
      if (!current || current.status === "CREDITED") return;

      const wallet = await txdb.wallet.upsert({
        where: { userId: current.userId },
        update: { balanceMinor: { increment: current.amountMinor }, currency: current.currency },
        create: { userId: current.userId, balanceMinor: current.amountMinor, currency: current.currency },
      });

      await txdb.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          userId: current.userId,
          type: "CREDIT",
          amountMinor: current.amountMinor,
          currency: current.currency,
          reference: `PAYSTACK_${current.reference}`,
          description: "Wallet funding via Paystack",
        },
      });

      await txdb.walletDeposit.update({
        where: { id: current.id },
        data: { status: "CREDITED", providerReference: String(tx.id) },
      });
    });

    return NextResponse.redirect(new URL(`/dashboard?deposit=credited&reference=${encodeURIComponent(reference)}`, request.url));
  } catch {
    const current = await db.walletDeposit.findUnique({ where: { reference } });
    if (current?.status === "CREDITED") {
      return NextResponse.redirect(new URL(`/dashboard?deposit=credited&reference=${encodeURIComponent(reference)}`, request.url));
    }
    return NextResponse.redirect(new URL(`/dashboard?deposit=verification_error&reference=${encodeURIComponent(reference)}`, request.url));
  }
}
