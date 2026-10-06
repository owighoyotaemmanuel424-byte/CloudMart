import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const user = await getSessionUser(jar.get(COOKIE)?.value);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      service: { select: { slug: true, name: true, category: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const webhookEvents = await db.webhookEvent.findMany({
    where: { provider: order.provider, OR: [
      { payload: { path: ["orderId"], equals: order.providerOrderId ?? "" } },
      { payload: { path: ["data", "orderId"], equals: order.providerOrderId ?? "" } },
      { payload: { path: ["order", "orderId"], equals: order.providerOrderId ?? "" } },
      { payload: { path: ["result", "orderId"], equals: order.providerOrderId ?? "" } },
    ] },
    orderBy: { createdAt: "asc" },
  }).catch(() => []);

  return NextResponse.json({
    ok: true,
    order: JSON.parse(JSON.stringify({ ...order, webhookEvents }, (_, v) => typeof v === "bigint" ? v.toString() : v)),
  });
}
