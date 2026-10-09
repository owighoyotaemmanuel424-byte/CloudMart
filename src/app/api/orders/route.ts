import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { createOrder } from "@/lib/orders/create-order";
import { rateLimitAll, RATE_LIMIT_WINDOWS, tooManyRequests } from "@/lib/security/rate-limit";

const schema = z.object({
  serviceSlug: z.string().min(1).max(200),
  request: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

// Only messages that a customer can act on are echoed back. Anything else is
// logged server-side and answered generically.
const SAFE_ERRORS: Record<string, { status: number; message: string }> = {
  "Service is unavailable": { status: 404, message: "Service is unavailable." },
  "Insufficient wallet balance": { status: 400, message: "Insufficient wallet balance. Fund your wallet and try again." },
  pricing_unavailable: { status: 400, message: "pricing_unavailable" },
  provider_path_unavailable: { status: 400, message: "This product is temporarily unavailable for purchase." },
  provider_method_unavailable: { status: 400, message: "This product is temporarily unavailable for purchase." },
  "Invalid idempotency key": { status: 400, message: "Invalid checkout request." },
  "Idempotency key already belongs to another account": { status: 400, message: "This checkout session is no longer valid. Start a new order." },
  unauthorized: { status: 401, message: "unauthorized" },
};

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const missing = message.match(/^provider_path_parameter_missing:(.+)$/);
  if (missing) {
    return { status: 400, message: `Missing required detail: ${missing[1]}`, known: true };
  }
  const known = SAFE_ERRORS[message];
  if (known) return { ...known, known: true };
  return { status: 400, message: "Unable to create this order right now.", known: false };
}

export async function POST(request: Request) {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const limited = rateLimitAll([
    { key: `orders:user:${user.id}`, limit: 60, windowMs: RATE_LIMIT_WINDOWS.hour },
    { key: "orders:global", limit: 1000, windowMs: RATE_LIMIT_WINDOWS.hour },
  ]);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid checkout request." }, { status: 400 });
  }

  try {
    const result = await createOrder({ ...parsed.data, userId: user.id });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const safe = safeError(error);
    if (!safe.known) console.error("[cloudmart] order creation failed", error);
    return NextResponse.json({ ok: false, error: safe.message }, { status: safe.status });
  }
}
