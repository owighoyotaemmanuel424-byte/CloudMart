import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/providers";

export async function syncProviderCatalog(providerName = "globalgle") {
  const provider = getProvider(providerName);
  const catalog = await provider.catalog();

  let products = 0;

  await db.$transaction(async (tx) => {
    // A successful full sync is authoritative for this provider. Disable
    // previously known products first so removed provider offerings cannot
    // remain purchasable after the provider catalog changes.
    await tx.providerProduct.updateMany({
      where: { provider: providerName },
      data: { enabled: false },
    });

    for (const item of catalog) {
      const service = await tx.service.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug,
        name: item.name,
        category: item.category || "Other",
        metadata: (item.metadata ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        name: item.name,
        category: item.category || "Other",
        metadata: (item.metadata ?? {}) as object,
      },
    });

      await tx.providerProduct.upsert({
      where: {
        provider_externalSlug: {
          provider: providerName,
          externalSlug: item.slug,
        },
      },
      create: {
        provider: providerName,
        externalSlug: item.slug,
        name: item.name,
        category: item.category,
        serviceId: service.id,
        metadata: item as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: item.name,
        category: item.category,
        serviceId: service.id,
        metadata: item as object,
      },
    });
      await tx.providerProduct.updateMany({
        where: { provider: providerName, externalSlug: item.slug },
        data: { enabled: true },
      });
      products++;
    }

    // A service remains enabled only when at least one provider product for it
    // is still enabled. This prevents stale service routes from appearing live.
    await tx.service.updateMany({
      where: {
        products: {
          none: { enabled: true },
        },
      },
      data: { enabled: false },
    });

    await tx.service.updateMany({
      where: {
        products: {
          some: { provider: providerName, enabled: true },
        },
      },
      data: { enabled: true },
    });
  });

  return { provider: providerName, services: catalog.length, products };
}
