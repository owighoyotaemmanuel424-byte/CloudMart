import crypto from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = process.env.GLOBALGLE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });

  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  const raw = await request.text();

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return NextResponse.json({ error: "stale_webhook" }, { status: 400 });
  }

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const supplied = signature.replace(/^sha256=/, "");
  const valid = supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

  if (!valid) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const event = JSON.parse(raw) as { id?: string; type?: string; [key: string]: unknown };
  // Persistence/dispatch is intentionally isolated here; order/event handlers will be added next.
  return NextResponse.json({ received: true, id: event.id ?? null, type: event.type ?? null });
}
