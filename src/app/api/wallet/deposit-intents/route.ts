import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { initializePaystack } from "@/lib/payments/paystack";
import { rateLimitAll, RATE_LIMIT_WINDOWS, tooManyRequests } from "@/lib/security/rate-limit";

const schema = z.object({ amountMinor: z.string().regex(/^\d+$/).refine(value => BigInt(value) >= 100, "Minimum deposit is ₦1.00") });

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const user = await getSessionUser(jar.get(COOKIE)?.value);
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const limited = rateLimitAll([
      { key: `deposit-intents:user:${user.id}`, limit: 20, windowMs: RATE_LIMIT_WINDOWS.hour },
      { key: "deposit-intents:global", limit: 500, windowMs: RATE_LIMIT_WINDOWS.hour },
    ]);
    if (!limited.ok) return tooManyRequests(limited);

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid deposit amount" },
        { status: 400 },
      );
    }
    const input = parsed.data;
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
        callbackUrl: process.env.CLOUDMART_PAYMENT_CALLBACK_URL || new URL("/api/wallet/deposit-callback", request.url).toString(),
        metadata: { depositId: intent.id, userId: user.id },
      });
      return NextResponse.json({ ok: true, intent: { ...intent, amountMinor: intent.amountMinor.toString() }, payment: payment.data });
    } catch (error) {
      console.error("[cloudmart] paystack initialization failed", error);
      await db.walletDeposit.update({ where: { id: intent.id }, data: { status: "FAILED", metadata: { createdFrom: "customer_wallet", failed: true } } });
      return NextResponse.json({ ok: false, error: "Payment provider is unavailable. Please try again." }, { status: 502 });
    }
  } catch (error) {
    console.error("[cloudmart] deposit intent failed", error);
    return NextResponse.json({ ok: false, error: "Unable to create this deposit right now." }, { status: 500 });
  }
}
