import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET() {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { service: { select: { slug: true, name: true, category: true } } },
  });
  return NextResponse.json({ ok: true, orders: orders.map(o => ({
    id: o.id, status: o.status, provider: o.provider, providerOrderId: o.providerOrderId,
    amountMinor: o.amountMinor.toString(), currency: o.currency, service: o.service, createdAt: o.createdAt,
  }))});
}
