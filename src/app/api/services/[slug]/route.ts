import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { resolveProductPricing } from "@/lib/catalog/pricing";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const item = (await getProvider("globalgle").catalog()).find(service => service.slug === slug);
    if (!item) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const pricing = resolveProductPricing(item.metadata);
    return NextResponse.json({
      ok: true,
      service: {
        ...item,
        pricing: pricing ? {
          providerAmount: pricing.providerAmount,
          providerCurrency: pricing.providerCurrency,
          sellMinor: pricing.sellMinor.toString(),
        } : null,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "provider_unavailable" }, { status: 503 });
  }
}
