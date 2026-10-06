import { calculateSellPrice, nairaToMinor, pricingConfig } from "@/lib/billing/pricing";

type JsonObject = Record<string, unknown>;

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value.replace(/,/g, "")))) return Number(value.replace(/,/g, ""));
  return undefined;
}

function findNumber(root: JsonObject, keys: string[], depth = 0): { value: number; source: string } | undefined {
  if (depth > 3) return undefined;
  for (const key of keys) {
    const value = numeric(root[key]);
    if (value !== undefined) return { value, source: key };
  }
  for (const [key, value] of Object.entries(root)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const found = findNumber(value as JsonObject, keys, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

export function resolveProductPricing(metadata: unknown) {
  const root = (metadata && typeof metadata === "object" ? metadata : {}) as JsonObject;

  const ngn = findNumber(root, [
    "priceNgn","amountNgn","price_ngn","amount_ngn","ngnPrice","ngn_price",
    "sellingPriceNgn","selling_price_ngn","costNgn","cost_ngn"
  ]);
  if (ngn) {
    return {
      providerAmount: String(ngn.value),
      providerCurrency: "NGN",
      sellMinor: nairaToMinor(ngn.value * (1 + pricingConfig.markupPercent / 100))
    };
  }

  const usd = findNumber(root, [
    "priceUsd","amountUsd","usdPrice","usd_price","price_usd","amount_usd",
    "sellingPriceUsd","selling_price_usd","costUsd","cost_usd"
  ]);
  if (usd) {
    return {
      providerAmount: String(usd.value),
      providerCurrency: "USD",
      sellMinor: nairaToMinor(calculateSellPrice(usd.value))
    };
  }

  const generic = findNumber(root, [
    "price","amount","cost","unitPrice","unit_price","sellingPrice","selling_price",
    "salePrice","sale_price","providerPrice","provider_price"
  ]);
  if (generic) {
    const currencyCandidate = findString(root, [
      "currency","priceCurrency","price_currency","currencyCode","currency_code"
    ]);
    const currency = currencyCandidate?.toUpperCase() ?? "USD";
    if (currency === "NGN" || currency === "NIRA") {
      return {
        providerAmount: String(generic.value),
        providerCurrency: "NGN",
        sellMinor: nairaToMinor(generic.value * (1 + pricingConfig.markupPercent / 100))
      };
    }
    if (currency === "USD") {
      return {
        providerAmount: String(generic.value),
        providerCurrency: "USD",
        sellMinor: nairaToMinor(calculateSellPrice(generic.value))
      };
    }
  }

  return null;
}

function findString(root: JsonObject, keys: string[], depth = 0): string | undefined {
  if (depth > 3) return undefined;
  for (const key of keys) {
    if (typeof root[key] === "string" && root[key].trim()) return root[key].trim();
  }
  for (const value of Object.values(root)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const found = findString(value as JsonObject, keys, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

export function markupForProviderCurrency(currency: string) {
  return currency.toUpperCase() === "USD" || currency.toUpperCase() === "NGN" ? pricingConfig.markupPercent : 0;
}
