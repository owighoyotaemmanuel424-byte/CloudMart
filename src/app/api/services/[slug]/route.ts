import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { resolveProductPricing } from "@/lib/catalog/pricing";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  let decodedSlug: string;
  try {
    decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  try {
    const item = (await getProvider("globalgle").catalog()).find(
      service => service.slug.trim().toLowerCase() === decodedSlug,
    );

    if (!item) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const pricing = resolveProductPricing(item.metadata);

    // Explicit public projection: never spread the raw provider product, which
    // carries the provider's cost basis and internal metadata.
    return NextResponse.json({
      ok: true,
      provider: "globalgle",
      source: "live",
      service: {
        slug: item.slug,
        name: item.name,
        category: item.category,
        description: item.description,
        providerId: item.providerId,
        requiredFields: item.requiredFields,
        imageUrl: item.imageUrl,
        pricing: pricing ? { sellMinor: pricing.sellMinor.toString(), currency: "NGN" } : null,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "provider_unavailable" }, { status: 503 });
  }
}
