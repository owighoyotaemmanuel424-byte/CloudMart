import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/providers";

export async function syncProviderCatalog(providerName = "globalgle") {
  const provider = getProvider(providerName);
  const catalog = await provider.catalog();

  let products = 0;
  for (const item of catalog) {
    const service = await db.service.upsert({
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

    await db.providerProduct.upsert({
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
    products++;
  }

  return { provider: providerName, services: catalog.length, products };
}
