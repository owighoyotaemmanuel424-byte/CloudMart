import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { createOrder } from "@/lib/orders/create-order";

const schema = z.object({
  serviceSlug: z.string().min(1).max(200),
  request: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const user = await getSessionUser(jar.get(COOKIE)?.value);
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const input = schema.parse(await request.json());
    const result = await createOrder({ ...input, userId: user.id });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order creation failed";
    const status = message === "unauthorized" ? 401 : message === "Service is unavailable" ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
