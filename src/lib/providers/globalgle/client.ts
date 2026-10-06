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
    const headers = new Headers({ "content-type": "application/json", accept: "application/json" });
    if (this.apiKey) {\n      headers.set("authorization", `Bearer ${this.apiKey}`);\n      headers.set("x-api-key", this.apiKey);\n    }
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
      // Transport failure is ambiguous: the provider may have accepted the request.
      const ambiguous = new Error("Globalgle request outcome is ambiguous");
      Object.assign(ambiguous, { code: "PROVIDER_OUTCOME_AMBIGUOUS", cause: error });
      throw ambiguous;
    }
    const text = await response.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
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
      const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
      return { ok: false, status, message: error instanceof Error ? error.message : "Provider error" };
    }
  }

  async balance() {
    return (await this.request({ path: "balance", method: "GET" })).data;
  }

  async catalog() {
    const paths = ["catalog", "services", "products"];
    let lastError: unknown;
    for (const path of paths) {
      try {
        const result = await this.request<unknown>({ path, method: "GET" });
        const normalized = normalizeCatalog(result.data);
        if (normalized.length > 0) return normalized;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return [];
  }function normalizeCatalog(input: unknown): ProviderCatalogItem[] {
  const items = findCatalogArray(input);
  return items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      slug: String(item.slug ?? item.code ?? item.service ?? item.productId ?? item.product_id ?? item.id ?? ""),
      name: String(item.name ?? item.title ?? item.productName ?? item.product_name ?? item.serviceName ?? item.service_name ?? item.slug ?? item.id ?? "Unnamed service"),
      category: typeof item.category === "string" ? item.category : typeof item.type === "string" ? item.type : typeof item.group === "string" ? item.group : undefined,
      basePath: typeof item.basePath === "string" ? item.basePath : undefined,
      scopes: Array.isArray(item.scopes) ? item.scopes.map(String) : undefined,
      actions: Array.isArray(item.actions) ? item.actions.map(String) : undefined,
      methods: Array.isArray(item.methods) ? item.methods.map(String) : undefined,
      requiredFields: Array.isArray(item.requiredFields) ? item.requiredFields.map(String) : undefined,
      siteTypes: Array.isArray(item.siteTypes) ? item.siteTypes.map(String) : undefined,
      metadata: item
    }))
    .filter((item) => item.slug.length > 0);
}

function findCatalogArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return [];
  const object = input as Record<string, unknown>;
  const preferred = ["services", "products", "catalog", "results", "data", "items"];
  for (const key of preferred) {
    const value = object[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = findCatalogArray(value);
      if (nested.length) return nested;
    }
  }
  for (const value of Object.values(object)) {
    if (Array.isArray(value) && value.some(item => item && typeof item === "object")) return value;
    if (value && typeof value === "object") {
      const nested = findCatalogArray(value);
      if (nested.length) return nested;
    }
  }
  return [];
}\n