import { getProvider } from "@/lib/providers";
import { resolveProductPricing } from "@/lib/catalog/pricing";

export type LiveCatalogService = {
  slug: string;
  name: string;
  category?: string;
  description?: string;
  providerId?: string;
  requiredFields?: string[];
  imageUrl?: string;
  purchasePath?: string;
  purchaseMethod?: "POST" | "PUT" | "PATCH";
  pricing: { providerAmount: string; providerCurrency: string; sellMinor: string } | null;
};

export async function getLiveCatalogServices(): Promise<LiveCatalogService[]> {
  const catalog = await getProvider("globalgle").catalog();

  return catalog.map(item => {
    const pricing = resolveProductPricing(item.metadata);
    return {
      slug: item.slug,
      name: item.name,
      category: item.category,
      description: item.description,
      providerId: item.providerId,
      requiredFields: item.requiredFields,
      imageUrl: item.imageUrl,
      purchasePath: item.purchasePath,
      purchaseMethod: item.purchaseMethod,
      pricing: pricing
        ? {
            providerAmount: pricing.providerAmount,
            providerCurrency: pricing.providerCurrency,
            sellMinor: pricing.sellMinor.toString(),
          }
        : null,
    };
  });
}
