import { calculateSellPrice, nairaToMinor, pricingConfig } from "@/lib/billing/pricing";

type JsonObject = Record<string, unknown>;

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function resolveProductPricing(metadata: unknown) {
  const root = (metadata && typeof metadata === "object" ? metadata : {}) as JsonObject;
  const nested = (root.pricing && typeof root.pricing === "object" ? root.pricing : {}) as JsonObject;
  const candidates = [root, nested];

  for (const source of candidates) {
    const ngn = numeric(source.priceNgn) ?? numeric(source.amountNgn);
    if (ngn !== undefined) {
      return { providerAmount: String(ngn), providerCurrency: "NGN", sellMinor: nairaToMinor(ngn * (1 + pricingConfig.markupPercent / 100)) };
    }

    const usd = numeric(source.priceUsd) ?? numeric(source.amountUsd) ?? numeric(source.usdPrice);
    if (usd !== undefined) {
      return {
        providerAmount: String(usd),
        providerCurrency: "USD",
        sellMinor: nairaToMinor(calculateSellPrice(usd)),
      };
    }

    const generic = numeric(source.price) ?? numeric(source.amount);
    if (generic !== undefined) {
      const currency = String(source.currency ?? source.priceCurrency ?? "USD").toUpperCase();
      if (currency === "NGN") {
        return { providerAmount: String(generic), providerCurrency: "NGN", sellMinor: nairaToMinor(generic * (1 + pricingConfig.markupPercent / 100)) };
      }
      if (currency === "USD") {
        return {
          providerAmount: String(generic),
          providerCurrency: "USD",
          sellMinor: nairaToMinor(calculateSellPrice(generic)),
        };
      }
    }
  }

  return null;
}

export function markupForProviderCurrency(currency: string) {
  return currency.toUpperCase() === "USD" || currency.toUpperCase() === "NGN" ? pricingConfig.markupPercent : 0;
}
