import { getProvider } from "@/lib/providers";
import { resolveProductPricing } from "@/lib/catalog/pricing";

/**
 * Public catalog shape. Provider cost basis, raw provider metadata and the
 * internal purchase route are intentionally omitted: this payload is served to
 * anonymous visitors.
 */
export type LiveCatalogService = {
  slug: string;
  name: string;
  category?: string;
  description?: string;
  providerId?: string;
  requiredFields?: string[];
  imageUrl?: string;
  pricing: { sellMinor: string; currency: string } | null;
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
      pricing: pricing
        ? { sellMinor: pricing.sellMinor.toString(), currency: "NGN" }
        : null,
    };
  });
}
