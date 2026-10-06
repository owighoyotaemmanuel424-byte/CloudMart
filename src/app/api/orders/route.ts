import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder } from "@/lib/orders/create-order";

const schema = z.object({
  userId: z.string().min(1),
  serviceSlug: z.string().min(1),
  amountMinor: z.string().regex(/^\d+$/),
  providerPath: z.string().startsWith("/"),
  request: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = await createOrder({
      ...input,
      amountMinor: BigInt(input.amountMinor),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Order creation failed" },
      { status: 400 },
    );
  }
}
