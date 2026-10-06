import { calculateSellPrice, nairaToMinor, pricingConfig } from "@/lib/billing/pricing";

type JsonObject = Record<string, unknown>;

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const cleaned = value
    .trim()
    .replace(/[₦$€£]/g, "")
    .replace(/,/g, "")
    .replace(/^\s*(ngn|nigeria naira|usd|us dollar|n|dollar)\s*[:=\-]?\s*/i, "")
    .replace(/\s*(ngn|nigeria naira|usd|us dollar)\s*$/i, "");

  if (cleaned !== "" && Number.isFinite(Number(cleaned))) return Number(cleaned);

  const extracted = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (extracted && Number.isFinite(Number(extracted[0]))) return Number(extracted[0]);
  return undefined;
}

function findNumber(root: JsonObject, keys: string[], depth = 0): { value: number; source: string } | undefined {
  if (depth > 6) return undefined;

  for (const key of keys) {
    const value = numeric(root[key]);
    if (value !== undefined) return { value, source: key };
  }

  for (const [key, value] of Object.entries(root)) {
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry && typeof entry === "object") {
            const found = findNumber(entry as JsonObject, keys, depth + 1);
            if (found) return found;
          }
        }
      } else {
        const found = findNumber(value as JsonObject, keys, depth + 1);
        if (found) return found;
      }
    }
  }

  return undefined;
}

function findCurrency(root: JsonObject, depth = 0): string | undefined {
  if (depth > 6) return undefined;

  const keys = [
    "currency",
    "currencyCode",
    "currency_code",
    "priceCurrency",
    "price_currency",
    "unitCurrency",
    "unit_currency",
    "currencyName",
    "currency_name",
  ];

  for (const key of keys) {
    const value = root[key];
    if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
  }

  for (const value of Object.values(root)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object") {
          const found = findCurrency(entry as JsonObject, depth + 1);
          if (found) return found;
        }
      }
    } else {
      const found = findCurrency(value as JsonObject, depth + 1);
      if (found) return found;
    }
  }

  return undefined;
}

function findLikelyPrice(root: JsonObject, depth = 0): { value: number; source: string } | undefined {
  if (depth > 6) return undefined;

  const explicitKeys = [
    "price",
    "amount",
    "cost",
    "rate",
    "value",
    "unitPrice",
    "unit_price",
    "sellingPrice",
    "selling_price",
    "salePrice",
    "sale_price",
    "providerPrice",
    "provider_price",
    "providerAmount",
    "provider_amount",
    "retailPrice",
    "retail_price",
    "basePrice",
    "base_price",
    "buyPrice",
    "buy_price",
  ];

  const direct = findNumber(root, explicitKeys, depth);
  if (direct) return direct;

  for (const [key, value] of Object.entries(root)) {
    if (
      /price|amount|cost|rate|value|fee|charge/i.test(key) &&
      (typeof value === "string" || typeof value === "number")
    ) {
      const parsed = numeric(value);
      if (parsed !== undefined && parsed >= 0) return { value: parsed, source: key };
    }
  }

  for (const value of Object.values(root)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object") {
          const found = findLikelyPrice(entry as JsonObject, depth + 1);
          if (found) return found;
        }
      }
    } else {
      const found = findLikelyPrice(value as JsonObject, depth + 1);
      if (found) return found;
    }
  }

  return undefined;
}

function priceFromCurrencyMap(root: JsonObject): { value: number; currency: string } | undefined {
  const candidates = [
    root.price,
    root.prices,
    root.amount,
    root.amounts,
    root.rates,
    root.rate,
    root.cost,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;

    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        if (!entry || typeof entry !== "object") continue;
        const found = priceFromCurrencyMap(entry as JsonObject);
        if (found) return found;
      }
      continue;
    }

    const map = candidate as JsonObject;
    for (const [key, value] of Object.entries(map)) {
      const parsed = numeric(value);
      if (parsed === undefined) continue;

      const currency = key.toUpperCase();
      if (currency === "NGN" || currency === "NIRA" || currency === "USD" || currency === "US DOLLAR") {
        return { value: parsed, currency: currency === "NIRA" ? "NGN" : currency === "US DOLLAR" ? "USD" : currency };
      }
    }
  }

  return undefined;
}

export function resolveProductPricing(metadata: unknown) {
  const root = (metadata && typeof metadata === "object" ? metadata : {}) as JsonObject;

  const mapped = priceFromCurrencyMap(root);
  if (mapped) return buildPricing(mapped.value, mapped.currency);

  const ngn = findNumber(root, [
    "priceNgn", "amountNgn", "price_ngn", "amount_ngn",
    "ngnPrice", "ngn_price", "sellingPriceNgn", "selling_price_ngn",
    "costNgn", "cost_ngn", "nairaPrice", "naira_price",
  ]);
  if (ngn) return buildPricing(ngn.value, "NGN");

  const usd = findNumber(root, [
    "priceUsd", "amountUsd", "usdPrice", "usd_price",
    "price_usd", "amount_usd", "sellingPriceUsd", "selling_price_usd",
    "costUsd", "cost_usd", "dollarPrice", "dollar_price",
  ]);
  if (usd) return buildPricing(usd.value, "USD");

  const generic = findLikelyPrice(root);
  if (generic) {
    const currency = findCurrency(root) ?? inferCurrencyFromPriceSource(generic.source);
    return buildPricing(generic.value, currency);
  }

  return null;
}

function inferCurrencyFromPriceSource(source: string) {
  const normalized = source.toLowerCase();
  if (normalized.includes("ngn") || normalized.includes("naira")) return "NGN";
  if (normalized.includes("usd") || normalized.includes("dollar")) return "USD";
  return "USD";
}

function buildPricing(value: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();

  if (normalizedCurrency === "NGN" || normalizedCurrency === "NIRA" || normalizedCurrency === "₦") {
    return {
      providerAmount: String(value),
      providerCurrency: "NGN",
      sellMinor: nairaToMinor(value * (1 + pricingConfig.markupPercent / 100)),
    };
  }

  if (normalizedCurrency === "USD" || normalizedCurrency === "US DOLLAR" || normalizedCurrency === "$" || normalizedCurrency === "US$") {
    return {
      providerAmount: String(value),
      providerCurrency: "USD",
      sellMinor: nairaToMinor(calculateSellPrice(value)),
    };
  }

  return null;
}

export function markupForProviderCurrency(currency: string) {
  return currency.toUpperCase() === "USD" || currency.toUpperCase() === "NGN"
    ? pricingConfig.markupPercent
    : 0;
}
