import { getProviderEnv } from "@/lib/env";
import type { ProviderAdapter, ProviderCatalogItem, ProviderRequest, ProviderResponse } from "@/lib/providers/types";

export class GlobalgleClient implements ProviderAdapter {
  readonly name = "globalgle" as const;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor() {
    const env = getProviderEnv();
    this.baseUrl = env.GLOBALGLE_API_BASE_URL.replace(/\/$/, "");
    this.apiKey = env.GLOBALGLE_API_KEY;
  }

  private headers(idempotencyKey?: string) {
    const headers = new Headers({
      "content-type": "application/json",
      accept: "application/json",
    });
    if (this.apiKey) {
      headers.set("authorization", `Bearer ${this.apiKey}`);
      headers.set("x-api-key", this.apiKey);
    }
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    return headers;
  }

  async request<T = unknown>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    if (!this.apiKey) throw new Error("GLOBALGLE_API_KEY is not configured");

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${request.path.replace(/^\//, "")}`, {
        method: request.method,
        headers: this.headers(request.idempotencyKey),
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      const ambiguous = new Error("Globalgle request outcome is ambiguous");
      Object.assign(ambiguous, { code: "PROVIDER_OUTCOME_AMBIGUOUS", cause: error });
      throw ambiguous;
    }

    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const error = new Error(`Globalgle request failed: ${response.status}`);
      Object.assign(error, { status: response.status, data });
      throw error;
    }

    return { data: data as T, status: response.status, headers: response.headers };
  }

  async health() {
    try {
      const result = await this.request({ path: "balance", method: "GET" });
      return { ok: true, status: result.status };
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error
        ? Number(error.status)
        : 500;
      return {
        ok: false,
        status,
        message: error instanceof Error ? error.message : "Provider error",
      };
    }
  }

  async balance() {
    return (await this.request({ path: "balance", method: "GET" })).data;
  }

  async catalog() {
    const paths = [
      "catalog",
      "services",
      "products",
      "catalog/services",
      "catalog/products",
      "services/list",
      "products/list",
    ];

    let lastError: unknown = null;

    for (const path of paths) {
      try {
        const result = await this.request<unknown>({ path, method: "GET" });
        const normalized = normalizeCatalog(result.data);

        console.info("[cloudmart] provider catalog probe", {
          path,
          status: result.status,
          products: normalized.length,
        });

        if (normalized.length > 0) return normalized;
      } catch (error) {
        lastError = error;
        console.warn("[cloudmart] provider catalog endpoint failed", {
          path,
          error: error instanceof Error ? error.message : "provider error",
        });
      }
    }

    if (lastError) throw lastError;
    return [];
  }
}

function normalizeCatalog(input: unknown): ProviderCatalogItem[] {
  const items = findCatalogItems(input);
  const seen = new Set<string>();
  const normalized: ProviderCatalogItem[] = [];

  for (const raw of items) {
    const item = toRecord(raw);
    if (!item) continue;

    const slug = firstString(item, [
      "slug", "code", "service", "serviceId", "service_id",
      "productId", "product_id", "productCode", "product_code", "id", "uid",
    ]);

    const name = firstString(item, [
      "name", "title", "productName", "product_name", "serviceName",
      "service_name", "serviceTitle", "service_title", "label", "description", "slug", "code", "id",
    ]);

    if (!slug || !name || slug === "[object Object]") continue;

    const key = slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const metadata = item;
    normalized.push({
      slug,
      name,
      category: firstStringDeep(item, [
        "category", "type", "group", "categoryName", "category_name", "productCategory", "product_category",
      ]),
      description: firstStringDeep(item, [
        "description", "summary", "shortDescription", "short_description", "details", "productDescription", "product_description",
      ]),
      imageUrl: firstStringDeep(item, [
        "imageUrl", "image_url", "image", "thumbnail", "thumbnailUrl", "thumbnail_url", "icon",
      ]),
      providerId: firstString(item, [
        "id", "uid", "productId", "product_id", "serviceId", "service_id", "code", "productCode", "product_code",
      ]),
      basePath: firstStringDeep(item, [
        "basePath", "base_path", "endpoint", "path", "url", "route", "apiPath", "api_path",
      ]),
      purchasePath: selectPurchaseAction(item.actions)?.path,
      purchaseMethod: selectPurchaseAction(item.actions)?.method,
      scopes: stringArray(item.scopes),
      actions: actionPaths(item.actions),
      methods: stringArray(item.methods),
      requiredFields: stringArrayDeep(item, [
        "requiredFields", "required_fields", "required", "fields", "inputs", "parameters", "formFields", "form_fields",
      ]),
      siteTypes: stringArray(item.siteTypes ?? item.site_types),
      metadata,
    });
  }

  return normalized;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function firstStringDeep(item: Record<string, unknown>, keys: string[]): string | undefined {
  const direct = firstString(item, keys);
  if (direct) return direct;

  for (const [key, value] of Object.entries(item)) {
    if (!value || typeof value !== "object") continue;
    const child = toRecord(value);
    if (child) {
      const found = firstString(child, keys);
      if (found) return found;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const record = toRecord(entry);
        if (!record) continue;
        const found = firstString(record, keys);
        if (found) return found;
      }
    }
    if (/category|product|service|meta|detail|config|request/i.test(key)) {
      const nested = toRecord(value);
      if (nested) {
        const found = firstStringDeep(nested, keys);
        if (found) return found;
      }
    }
  }
  return undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value
    .map((entry) => {
      if (typeof entry === "string" || typeof entry === "number") return String(entry);
      const record = toRecord(entry);
      return record ? firstString(record, ["name", "key", "id", "value", "slug"]) : null;
    })
    .filter((entry): entry is string => Boolean(entry));
  return result.length ? result : undefined;
}

function stringArrayDeep(item: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = item[key];
    const parsed = stringArray(value);
    if (parsed) return parsed;
  }

  for (const value of Object.values(item)) {
    const record = toRecord(value);
    if (record) {
      const found = stringArrayDeep(record, keys);
      if (found) return found;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const record = toRecord(entry);
        if (!record) continue;
        const found = stringArrayDeep(record, keys);
        if (found) return found;
      }
    }
  }
  return undefined;
}

type CatalogAction = {
  method?: string;
  path?: string;
  summary?: string;
  required?: unknown;
};

function actionRecords(value: unknown): CatalogAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => toRecord(entry))
    .filter((entry): entry is CatalogAction => Boolean(entry));
}

function actionPaths(value: unknown): string[] | undefined {
  const paths = actionRecords(value)
    .map(action => typeof action.path === "string" ? action.path.trim() : "")
    .filter(Boolean);
  return paths.length ? Array.from(new Set(paths)) : undefined;
}

function selectPurchaseAction(value: unknown): { path: string; method: "POST" | "PUT" | "PATCH" } | undefined {
  const actions = actionRecords(value);
  const candidates = actions
    .map(action => {
      const method = typeof action.method === "string" ? action.method.toUpperCase() : "";
      const path = typeof action.path === "string" ? action.path.trim() : "";
      const summary = typeof action.summary === "string" ? action.summary.toLowerCase() : "";
      if (!path || !["POST", "PUT", "PATCH"].includes(method)) return null;

      const normalizedPath = path.toLowerCase();
      let score = method === "POST" ? 10 : 6;
      if (Array.isArray(action.required) && action.required.length) score += 5;
      if (/create|register|send|rent|generate|add|buy|renew|resize|edit|update|verify|order|provision/.test(summary)) score += 8;
      if (/\/quote|\/search|\/pricing|\/config|\/providers|\/countries|\/languages|\/voices\b|blocked-countries/.test(normalizedPath)) score -= 20;
      if (/\/{id}|\/{domain}/.test(path)) score += 3;

      return { path, method: method as "POST" | "PUT" | "PATCH", score };
    })
    .filter((entry): entry is { path: string; method: "POST" | "PUT" | "PATCH"; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  const winner = candidates[0];
  return winner ? { path: winner.path, method: winner.method } : undefined;
}

function findCatalogItems(input: unknown): unknown[] {
  const candidates: unknown[][] = [];
  const visited = new Set<object>();

  const walk = (value: unknown, depth: number) => {
    if (depth > 8 || value === null || value === undefined) return;

    if (Array.isArray(value)) {
      if (value.some((entry) => looksLikeProduct(entry))) candidates.push(value);
      for (const entry of value) walk(entry, depth + 1);
      return;
    }

    if (typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    if (visited.has(object)) return;
    visited.add(object);

    const priorityKeys = [
      "services", "products", "catalog", "results", "data",
      "items", "records", "rows", "list",
    ];

    for (const key of priorityKeys) {
      if (key in object) walk(object[key], depth + 1);
    }

    for (const [key, child] of Object.entries(object)) {
      if (!priorityKeys.includes(key)) walk(child, depth + 1);
    }
  };

  walk(input, 0);

  const best = candidates.sort(
    (a, b) => b.filter(looksLikeProduct).length - a.filter(looksLikeProduct).length,
  )[0];
  return best ?? (Array.isArray(input) ? input : []);
}

function looksLikeProduct(value: unknown): boolean {
  const item = toRecord(value);
  if (!item) return false;

  return [
    "id", "uid", "slug", "code", "service", "serviceId", "service_id",
    "productId", "product_id", "productCode", "product_code",
    "name", "title", "productName", "product_name", "serviceName", "service_name",
  ].some((key) => {
    const value = item[key];
    return typeof value === "string" || typeof value === "number";
  });
}
