import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { initializePaystack } from "@/lib/payments/paystack";

const schema = z.object({ amountMinor: z.string().regex(/^\d+$/).refine(value => BigInt(value) >= 100, "Minimum deposit is ₦1.00") });

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const user = await getSessionUser(jar.get(COOKIE)?.value);
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const input = schema.parse(await request.json());
    const amountMinor = BigInt(input.amountMinor);
    const reference = `CMDEP_${crypto.randomBytes(10).toString("hex")}`;
    const intent = await db.walletDeposit.create({
      data: { userId: user.id, amountMinor, reference, status: "PENDING", paymentProvider: "paystack", metadata: { createdFrom: "customer_wallet" } },
      select: { id: true, amountMinor: true, currency: true, reference: true, status: true, createdAt: true },
    });

    try {
      const payment = await initializePaystack({
        email: user.email,
        amountMinor,
        reference,
        callbackUrl: process.env.CLOUDMART_PAYMENT_CALLBACK_URL,
        metadata: { depositId: intent.id, userId: user.id },
      });
      return NextResponse.json({ ok: true, intent: { ...intent, amountMinor: intent.amountMinor.toString() }, payment: payment.data });
    } catch (error) {
      await db.walletDeposit.update({ where: { id: intent.id }, data: { status: "FAILED", metadata: { createdFrom: "customer_wallet", error: error instanceof Error ? error.message : "Paystack initialization failed" } } });
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create deposit" }, { status: 400 });
  }
}
