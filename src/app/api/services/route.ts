import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { resolveProductPricing } from "@/lib/catalog/pricing";

export async function GET() {
  if (!process.env.GLOBALGLE_API_KEY) {
    return NextResponse.json({ ok: false, error: "provider_not_configured" }, { status: 503 });
  }

  try {
    const catalog = await getProvider("globalgle").catalog();
    const services = catalog.map(item => {
      const pricing = resolveProductPricing(item.metadata);
      return {
        ...item,
        pricing: pricing ? {
          providerAmount: pricing.providerAmount,
          providerCurrency: pricing.providerCurrency,
          sellMinor: pricing.sellMinor.toString(),
        } : null,
      };
    });

    return NextResponse.json({
      ok: true,
      provider: "globalgle",
      source: "live",
      count: services.length,
      services,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "provider_unavailable",
      source: "live",
      services: [],
    }, { status: 503 });
  }
}
