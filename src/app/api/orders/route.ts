import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { createOrder } from "@/lib/orders/create-order";

const schema = z.object({
  serviceSlug: z.string().min(1),
  amountMinor: z.string().regex(/^\d+$/),
  providerPath: z.string().startsWith("/"),
  request: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const user = await getSessionUser(jar.get(COOKIE)?.value);
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    const input = schema.parse(await request.json());
    const result = await createOrder({ ...input, userId: user.id, amountMinor: BigInt(input.amountMinor) });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Order creation failed" }, { status: 400 });
  }
}
