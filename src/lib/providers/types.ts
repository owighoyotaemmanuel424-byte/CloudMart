export type ProviderName = "globalgle" | string;

export interface ProviderRequest {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
}

export interface ProviderResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ProviderCatalogItem {
  slug: string;
  name: string;
  category?: string;
  basePath?: string;
  scopes?: string[];
  actions?: string[];
  methods?: string[];
  requiredFields?: string[];
  siteTypes?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProviderAdapter {
  readonly name: ProviderName;
  health(): Promise<{ ok: boolean; status: number; message?: string }>;
  balance(): Promise<unknown>;
  catalog(): Promise<ProviderCatalogItem[]>;
  request<T = unknown>(request: ProviderRequest): Promise<ProviderResponse<T>>;
}
