import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyPaystackSignature } from "@/lib/payments/paystack";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }
  try {
    const event = JSON.parse(rawBody) as { event?: string; data?: { id?: number; reference?: string; amount?: number; currency?: string } };
    const externalId = event.data?.id != null ? String(event.data.id) : event.data?.reference;
    if (!externalId) return NextResponse.json({ ok: true, ignored: true });
    const existing = await db.webhookEvent.findUnique({ where: { provider_externalId: { provider: "paystack", externalId } } });
    if (existing?.processedAt) return NextResponse.json({ ok: true, duplicate: true });
    const webhook = existing ?? await db.webhookEvent.create({ data: { provider: "paystack", externalId, eventType: event.event ?? "unknown", payload: JSON.parse(rawBody) } });
    if (event.event !== "charge.success") {
      await db.webhookEvent.update({ where: { id: webhook.id }, data: { processedAt: new Date() } });
      return NextResponse.json({ ok: true, ignored: true });
    }
    const reference = event.data?.reference;
    const amount = event.data?.amount;
    if (!reference || amount == null || event.data?.currency !== "NGN") throw new Error("Invalid Paystack payment payload");
    const result = await db.$transaction(async tx => {
      const deposit = await tx.walletDeposit.findUnique({ where: { reference } });
      if (!deposit) throw new Error("Unknown deposit reference");
      if (deposit.status === "CREDITED") return { duplicate: true };
      if (BigInt(amount) !== deposit.amountMinor) throw new Error("Paystack amount mismatch");

      const ledgerReference = `PAYSTACK_${deposit.reference}`;
      const existingLedger = await tx.ledgerEntry.findUnique({ where: { reference: ledgerReference } });

      if (!existingLedger) {
        const wallet = await tx.wallet.upsert({
          where: { userId: deposit.userId },
          create: { userId: deposit.userId, balanceMinor: 0n, currency: deposit.currency },
          update: {},
        });

        let createdLedger = false;
        try {
          await tx.ledgerEntry.create({
            data: {
              userId: deposit.userId,
              walletId: wallet.id,
              type: "CREDIT",
              amountMinor: deposit.amountMinor,
              currency: deposit.currency,
              reference: ledgerReference,
              description: "Wallet funding via Paystack",
              metadata: { depositId: deposit.id, providerReference: reference },
            },
          });
          createdLedger = true;
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        }

        if (createdLedger) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceMinor: { increment: deposit.amountMinor } },
          });
        }
      }

      await tx.walletDeposit.update({
        where: { id: deposit.id },
        data: { status: "CREDITED", providerReference: reference, metadata: { creditedBy: "paystack_webhook" } },
      });
      await tx.webhookEvent.update({ where: { id: webhook.id }, data: { processedAt: new Date() } });
      return { duplicate: Boolean(existingLedger) };
    });
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 400 });
  }
}
