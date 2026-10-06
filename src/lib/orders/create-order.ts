import crypto from "node:crypto";
import { Prisma, OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { debitWallet, refundWallet } from "@/lib/billing/wallet";
import { getProvider } from "@/lib/providers";

export type CreateOrderInput = {
  userId: string;
  serviceSlug: string;
  amountMinor: bigint;
  request: Record<string, unknown>;
  provider?: string;
  providerPath: string;
};

export async function createOrder(input: CreateOrderInput) {
  if (input.amountMinor <= 0n) throw new Error("Order amount must be positive");

  const providerName = input.provider ?? "globalgle";
  const idempotencyKey = crypto.randomUUID();

  const product = await db.providerProduct.findFirst({
    where: {
      provider: providerName,
      externalSlug: input.serviceSlug,
      enabled: true,
      service: { enabled: true },
    },
    include: { service: true },
  });

  if (!product) throw new Error("Service is unavailable");

  const order = await db.order.create({
    data: {
      userId: input.userId,
      serviceId: product.serviceId,
      provider: providerName,
      amountMinor: input.amountMinor,
      markupPercent: 0,
      idempotencyKey,
      requestSnapshot: input.request as Prisma.InputJsonValue,
    },
  });

  try {
    await debitWallet({
      userId: input.userId,
      amountMinor: input.amountMinor,
      reference: `order:${order.id}:debit`,
      description: `CloudMart order ${order.id}`,
      metadata: { orderId: order.id, service: input.serviceSlug } as Prisma.InputJsonValue,
    });

    await db.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PROCESSING },
    });

    await db.orderEvent.create({
      data: {
        orderId: order.id,
        type: "wallet_debited",
        payload: { amountMinor: input.amountMinor.toString() },
      },
    });

    const provider = getProvider(providerName);
    const response = await provider.request({
      method: "POST",
      path: input.providerPath,
      body: input.request,
      idempotencyKey,
    });

    const body = response.data as Record<string, unknown>;
    const providerOrderId = typeof body.id === "string" ? body.id : typeof body.orderId === "string" ? body.orderId : undefined;

    await db.order.update({
      where: { id: order.id },
      data: {
        providerOrderId,
        status: OrderStatus.PROCESSING,
        responseSnapshot: body as unknown as Prisma.InputJsonValue,
      },
    });

    await db.orderEvent.create({
      data: {
        orderId: order.id,
        type: "provider_accepted",
        payload: body as unknown as Prisma.InputJsonValue,
      },
    });

    return { orderId: order.id, status: OrderStatus.PROCESSING, provider: body };
  } catch (error) {
    await refundWallet({
      userId: input.userId,
      amountMinor: input.amountMinor,
      reference: `order:${order.id}:refund`,
      description: `Refund for failed CloudMart order ${order.id}`,
      metadata: { orderId: order.id } as Prisma.InputJsonValue,
    });

    await db.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.REFUNDED },
    });

    await db.orderEvent.create({
      data: {
        orderId: order.id,
        type: "provider_failed_refunded",
        payload: { error: error instanceof Error ? error.message : "Provider request failed" },
      },
    });

    throw error;
  }
}
