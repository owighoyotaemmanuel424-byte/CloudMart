import crypto from "node:crypto";
import { Prisma, OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { debitWallet, refundWallet } from "@/lib/billing/wallet";
import { getProvider } from "@/lib/providers";
import { markupForProviderCurrency, resolveProductPricing } from "@/lib/catalog/pricing";

export type CreateOrderInput = {
  userId: string;
  serviceSlug: string;
  request: Record<string, unknown>;
  idempotencyKey?: string;
};

export async function createOrder(input: CreateOrderInput) {
  const requestedKey = input.idempotencyKey?.trim();
  if (requestedKey && requestedKey.length > 120) throw new Error("Invalid idempotency key");

  const providerName = "globalgle";
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

  const pricing = resolveProductPricing(product.metadata);
  if (!pricing) throw new Error("pricing_unavailable");

  const idempotencyKey = requestedKey || crypto.randomUUID();
  if (requestedKey) {
    const existing = await db.order.findUnique({ where: { idempotencyKey: requestedKey } });
    if (existing) {
      if (existing.userId !== input.userId) throw new Error("Idempotency key already belongs to another account");
      return { orderId: existing.id, status: existing.status, replayed: true };
    }
  }

  const metadata = (product.metadata && typeof product.metadata === "object"
    ? product.metadata
    : {}) as Record<string, unknown>;
  const providerPath = typeof metadata.basePath === "string" && metadata.basePath.startsWith("/")
    ? metadata.basePath
    : typeof metadata.path === "string" && metadata.path.startsWith("/")
      ? metadata.path
      : undefined;

  if (!providerPath) throw new Error("provider_path_unavailable");

  const markupPercent = markupForProviderCurrency(pricing.providerCurrency);
  const order = await db.order.create({
    data: {
      userId: input.userId,
      serviceId: product.serviceId,
      provider: providerName,
      amountMinor: pricing.sellMinor,
      providerAmount: pricing.providerAmount,
      markupPercent,
      idempotencyKey,
      requestSnapshot: input.request as Prisma.InputJsonValue,
    },
  });

  try {
    await debitWallet({
      userId: input.userId,
      amountMinor: pricing.sellMinor,
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
        payload: { amountMinor: pricing.sellMinor.toString(), providerAmount: pricing.providerAmount, providerCurrency: pricing.providerCurrency },
      },
    });

    const response = await getProvider(providerName).request({
      method: "POST",
      path: providerPath,
      body: input.request,
      idempotencyKey,
    });

    const body = response.data as Record<string, unknown>;
    const providerOrderId = typeof body.id === "string"
      ? body.id
      : typeof body.orderId === "string" ? body.orderId : undefined;

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

    return { orderId: order.id, status: OrderStatus.PROCESSING, provider: body, amountMinor: pricing.sellMinor.toString() };
  } catch (error) {
    await refundWallet({
      userId: input.userId,
      amountMinor: pricing.sellMinor,
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
