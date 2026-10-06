import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

function terminalStatus(payload: unknown) {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const values = [
    root.status, root.event, root.eventType,
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>).status : undefined,
    root.order && typeof root.order === "object" ? (root.order as Record<string, unknown>).status : undefined,
    root.result && typeof root.result === "object" ? (root.result as Record<string, unknown>).status : undefined,
  ];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const s = value.toLowerCase().replace(/[-:]/g, "_");
    if (["completed","complete","success","successful","succeeded","delivered","order_completed","order_success"].includes(s)) return "COMPLETED";
    if (["failed","failure","error","rejected","declined","order_failed","order_failure"].includes(s)) return "FAILED";
    if (["cancelled","canceled","order_cancelled","order_canceled"].includes(s)) return "CANCELLED";
  }
  return null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const admin = await getSessionUser(jar.get(COOKIE)?.value);
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, select: { id: true, provider: true, providerOrderId: true, status: true } });
  if (!order) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!order.providerOrderId) return NextResponse.json({ ok: true, reconcilable: false, reason: "provider_order_id_missing" });

  const events = await db.webhookEvent.findMany({
    where: { provider: order.provider, OR: [
      { payload: { path: ["orderId"], equals: order.providerOrderId } },
      { payload: { path: ["data", "orderId"], equals: order.providerOrderId } },
      { payload: { path: ["order", "orderId"], equals: order.providerOrderId } },
      { payload: { path: ["result", "orderId"], equals: order.providerOrderId } },
    ] },
    orderBy: { createdAt: "desc" },
    select: { id: true, eventType: true, createdAt: true, processedAt: true, payload: true },
  });

  const evidence = events.map(event => ({ id: event.id, eventType: event.eventType, createdAt: event.createdAt, processedAt: event.processedAt, status: terminalStatus(event.payload) }))
    .filter(event => event.status);

  return NextResponse.json({ ok: true, orderStatus: order.status, reconcilable: evidence.length > 0, evidence });
}
