import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { OrderStatus, LedgerType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractString(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const direct = stringValue(payload[key]);
    if (direct) return direct;
  }
  for (const key of ["data", "order", "result"]) {
    const nested = payload[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const found = extractString(nested as Record<string, unknown>, keys);
      if (found) return found;
    }
  }
  return undefined;
}

function canApplyProviderStatus(current: OrderStatus, incoming: OrderStatus) {
  if (current === OrderStatus.PENDING || current === OrderStatus.PROCESSING) {
    return [OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.FAILED, OrderStatus.CANCELLED].includes(incoming);
  }
  return false;
}

function normalizeStatus(payload: Record<string, unknown>) {
  const raw = extractString(payload, ["status", "orderStatus", "state", "event"]);
  if (!raw) return undefined;
  const value = raw.toLowerCase().replace(/[-\s]+/g, "_");
  const candidates = [value, value.split(".").pop() ?? value, value.split(":").pop() ?? value];
  const has = (values: string[]) => candidates.some((candidate) => values.includes(candidate));
  if (has(["completed", "complete", "success", "successful", "succeeded", "delivered"])) return OrderStatus.COMPLETED;
  if (has(["failed", "failure", "error", "rejected", "declined"])) return OrderStatus.FAILED;
  if (has(["cancelled", "canceled"])) return OrderStatus.CANCELLED;
  if (has(["processing", "pending", "in_progress", "queued"])) return OrderStatus.PROCESSING;
  return undefined;
}

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

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const externalId = extractString(body, ["eventId", "webhookId", "id", "reference", "orderId", "order_id"]);
  const providerOrderId = extractString(body, ["orderId", "order_id", "providerOrderId", "provider_order_id", "id"]);
  const status = normalizeStatus(body);
  if (!externalId || !providerOrderId || !status) {
    return NextResponse.json({ error: "missing_event_fields" }, { status: 400 });
  }

  const eventType = extractString(body, ["type", "event", "eventType"]) ?? status.toLowerCase();
  const event = await db.webhookEvent.upsert({
    where: { provider_externalId: { provider: "globalgle", externalId } },
    create: { provider: "globalgle", externalId, eventType, payload: body as Prisma.InputJsonValue },
    update: { eventType, payload: body as Prisma.InputJsonValue },
  });

  if (event.processedAt) return NextResponse.json({ received: true, duplicate: true });

  // Claim this webhook before creating any order events. A short claim lease
  // prevents concurrent deliveries from both processing the same event, while
  // allowing recovery if a server instance crashes mid-processing.
  const claimCutoff = new Date(Date.now() - 5 * 60 * 1000);
  const claim = await db.webhookEvent.updateMany({
    where: {
      id: event.id,
      processedAt: null,
      OR: [{ processingAt: null }, { processingAt: { lt: claimCutoff } }],
    },
    data: { processingAt: new Date() },
  });

  if (claim.count !== 1) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const order = await db.order.findFirst({
    where: { provider: "globalgle", providerOrderId },
    select: { id: true, userId: true, amountMinor: true, status: true },
  });

  if (!order) {
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date(), processingAt: null },
    });
    return NextResponse.json({ received: true, ignored: "order_not_found" });
  }

  await db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (!current) return;

    if (!canApplyProviderStatus(current.status, status)) {
      await tx.orderEvent.create({
        data: {
          orderId: current.id,
          type: "provider_webhook_ignored_transition",
          payload: {
            source: "globalgle",
            incomingStatus: status,
            currentStatus: current.status,
          },
        },
      });
      await tx.webhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), processingAt: null },
      });
      return;
    }

    if (status !== OrderStatus.FAILED) {
      await tx.order.update({
        where: { id: current.id },
        data: { status, responseSnapshot: body as Prisma.InputJsonValue },
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: current.id,
        type: `provider_webhook_${status.toLowerCase()}`,
        payload: body as Prisma.InputJsonValue,
      },
    });

    if (status === OrderStatus.FAILED && current.status !== OrderStatus.COMPLETED) {
      const reference = `order:${current.id}:refund`;
      const existing = await tx.ledgerEntry.findUnique({ where: { reference } });

      if (!existing) {
        const wallet = await tx.wallet.upsert({
          where: { userId: current.userId },
          create: { userId: current.userId, balanceMinor: current.amountMinor },
          update: { balanceMinor: { increment: current.amountMinor } },
        });

        try {
          await tx.ledgerEntry.create({
            data: {
              userId: current.userId,
              walletId: wallet.id,
              type: LedgerType.CREDIT,
              amountMinor: current.amountMinor,
              reference,
              description: `Refund for failed CloudMart order ${current.id}`,
              metadata: { orderId: current.id, provider: "globalgle", source: "webhook" },
            },
          });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        }
      }

      await tx.order.update({
        where: { id: current.id },
        data: { status: OrderStatus.REFUNDED, responseSnapshot: body as Prisma.InputJsonValue },
      });

      if (!existing) {
        await tx.orderEvent.create({
          data: {
            orderId: current.id,
            type: "provider_failed_refunded",
            payload: { source: "webhook" },
          },
        });
      }
    }

    await tx.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date(), processingAt: null },
    });
  });

  return NextResponse.json({ received: true });
}
