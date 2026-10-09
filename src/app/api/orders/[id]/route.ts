import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const order = await db.order.findFirst({
    where: { id, userId: user.id },
    include: {
      service: { select: { slug: true, name: true, category: true } },
      events: { orderBy: { createdAt: "asc" }, select: { id: true, type: true, payload: true, createdAt: true } },
    },
  });

  if (!order) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      status: order.status,
      provider: order.provider,
      providerOrderId: order.providerOrderId,
      amountMinor: order.amountMinor.toString(),
      providerAmount: order.providerAmount,
      markupPercent: order.markupPercent?.toString() ?? null,
      currency: order.currency,
      service: order.service,
      request: order.requestSnapshot,
      response: order.responseSnapshot,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      events: order.events.map(event => ({ ...event, createdAt: event.createdAt })),
    },
  }, { headers: { "cache-control": "private, no-store" } });
}
