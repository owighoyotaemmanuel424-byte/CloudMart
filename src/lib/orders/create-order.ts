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

function normalizeProviderPath(path: string) {
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return normalizeProviderPath(url.pathname);
    } catch {
      return trimmed.replace(/^\//, "");
    }
  }
  return trimmed
    .replace(/^\/+/, "")
    .replace(/^api\/v1\//i, "")
    .replace(/^v1\//i, "");
}

function fillProviderPath(path: string, request: Record<string, unknown>) {
  const filled = path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = request[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new Error("provider_path_parameter_missing:" + key);
    }
    return encodeURIComponent(String(value));
  });
  return filled;
}

function findPurchaseAction(metadata: Record<string, unknown>) {
  const actions = Array.isArray(metadata.actions) ? metadata.actions : [];
  const candidates = actions
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map(action => {
      const method = typeof action.method === "string" ? action.method.toUpperCase() : "";
      const path = typeof action.path === "string" ? action.path.trim() : "";
      const summary = typeof action.summary === "string" ? action.summary.toLowerCase() : "";
      if (!path || !["POST", "PUT", "PATCH"].includes(method)) return null;

      let score = method === "POST" ? 10 : 6;
      if (Array.isArray(action.required) && action.required.length) score += 5;
      if (/create|register|send|rent|generate|add|buy|renew|resize|edit|update|verify|order|provision/.test(summary)) score += 8;
      if (/\/quote|\/search|\/pricing|\/config|\/providers|\/countries|\/languages|\/voices\b|blocked-countries/.test(path.toLowerCase())) score -= 20;

      return { path: normalizeProviderPath(path), method: method as "POST" | "PUT" | "PATCH", score };
    })
    .filter((entry): entry is { path: string; method: "POST" | "PUT" | "PATCH"; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  return candidates[0];
}

export async function createOrder(input: CreateOrderInput) {
  const requestedKey = input.idempotencyKey?.trim();
  if (requestedKey && requestedKey.length > 120) throw new Error("Invalid idempotency key");

  const providerName = "globalgle";
  const provider = getProvider(providerName);

  // Tudowebs is the source of truth for the public catalog. Keep a local
  // ProviderProduct mirror for orders/audit, but hydrate it from the live
  // provider when a product is not already present in Prisma.
  let product = await db.providerProduct.findFirst({
    where: {
      provider: providerName,
      externalSlug: input.serviceSlug,
      enabled: true,
      service: { enabled: true },
    },
    include: { service: true },
  });

  if (!product) {
    const live = (await provider.catalog()).find(item => item.slug === input.serviceSlug);
    if (!live) throw new Error("Service is unavailable");

    const metadata = {
      ...((live.metadata ?? {}) as Record<string, unknown>),
      purchasePath: live.purchasePath,
      purchaseMethod: live.purchaseMethod,
    } as Prisma.InputJsonValue;
    const service = await db.service.upsert({
      where: { slug: live.slug },
      create: {
        slug: live.slug,
        name: live.name,
        category: live.category || "Digital",
        metadata,
        enabled: true,
      },
      update: {
        name: live.name,
        category: live.category || "Digital",
        metadata,
        enabled: true,
      },
    });

    product = await db.providerProduct.upsert({
      where: {
        provider_externalSlug: {
          provider: providerName,
          externalSlug: live.slug,
        },
      },
      create: {
        provider: providerName,
        externalSlug: live.slug,
        name: live.name,
        category: live.category,
        metadata,
        serviceId: service.id,
        enabled: true,
      },
      update: {
        name: live.name,
        category: live.category,
        metadata,
        serviceId: service.id,
        enabled: true,
      },
      include: { service: true },
    });
  }

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

  const purchase = findPurchaseAction(metadata);
  const providerPath =
    typeof metadata.purchasePath === "string" && metadata.purchasePath.trim()
      ? normalizeProviderPath(metadata.purchasePath)
      : purchase?.path;

  const providerMethod =
    typeof metadata.purchaseMethod === "string" &&
    ["POST", "PUT", "PATCH"].includes(metadata.purchaseMethod.toUpperCase())
      ? metadata.purchaseMethod.toUpperCase() as "POST" | "PUT" | "PATCH"
      : purchase?.method;

  if (!providerPath) throw new Error("provider_path_unavailable");
  if (!providerMethod) throw new Error("provider_method_unavailable");

  const markupPercent = markupForProviderCurrency(pricing.providerCurrency);

  let order;
  try {
    order = await db.order.create({
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
  } catch (error) {
    // The unique idempotencyKey constraint is the final race-safe gate.
    // If two requests arrive simultaneously, only one creates the order;
    // the loser replays the already-created order instead of charging twice.
    if (
      requestedKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.order.findUnique({ where: { idempotencyKey } });
      if (existing) {
        if (existing.userId !== input.userId) {
          throw new Error("Idempotency key already belongs to another account");
        }
        return { orderId: existing.id, status: existing.status, replayed: true };
      }
    }
    throw error;
  }

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

    const response = await provider.request({
      method: providerMethod,
      path: fillProviderPath(providerPath, input.request),
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
    const isAmbiguous =
      error instanceof Error &&
      "code" in error &&
      error.code === "PROVIDER_OUTCOME_AMBIGUOUS";

    if (isAmbiguous) {
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          type: "provider_outcome_ambiguous",
          payload: {
            message: "Provider request outcome could not be confirmed; order remains PROCESSING for reconciliation.",
          },
        },
      });

      return {
        orderId: order.id,
        status: OrderStatus.PROCESSING,
        providerOutcome: "ambiguous",
        amountMinor: pricing.sellMinor.toString(),
      };
    }

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
