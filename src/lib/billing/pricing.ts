import { z } from "zod";

const envNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const pricingConfig = {
  markupPercent: envNumber("CLOUDMART_DEFAULT_MARKUP_PERCENT", 15),
  usdToNgn: envNumber("CLOUDMART_USD_TO_NGN", 1600),
};

export function calculateSellPrice(providerUsd: number, markupPercent = pricingConfig.markupPercent) {
  if (!Number.isFinite(providerUsd) || providerUsd < 0) throw new Error("Invalid provider price");
  if (!Number.isFinite(markupPercent) || markupPercent < 0) throw new Error("Invalid markup");
  const ngn = providerUsd * pricingConfig.usdToNgn;
  return Math.ceil(ngn * (1 + markupPercent / 100) * 100) / 100;
}

export function nairaToMinor(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid NGN amount");
  return BigInt(Math.round(amount * 100));
}

export function priceInputSchema() {
  return z.object({
    providerUsd: z.number().nonnegative(),
    markupPercent: z.number().min(0).max(1000).optional(),
  });
}
