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
    if (this.apiKey) headers.set("authorization", `Bearer ${this.apiKey}`);
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    return headers;
  }

  async request<T = unknown>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    if (!this.apiKey) throw new Error("GLOBALGLE_API_KEY is not configured");
    const response = await fetch(`${this.baseUrl}/${request.path.replace(/^\//, "")}`, {
      method: request.method,
      headers: this.headers(request.idempotencyKey),
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      cache: "no-store"
    });
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
    const result = await this.request<unknown>({ path: "catalog", method: "GET" });
    return normalizeCatalog(result.data);
  }
}

function normalizeCatalog(input: unknown): ProviderCatalogItem[] {
  const items = Array.isArray(input) ? input : (
    typeof input === "object" && input !== null && Array.isArray((input as { services?: unknown }).services)
      ? (input as { services: unknown[] }).services : []
  );

  return items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      slug: String(item.slug ?? item.id ?? ""),
      name: String(item.name ?? item.title ?? item.slug ?? item.id ?? "Unnamed service"),
      category: typeof item.category === "string" ? item.category : undefined,
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
