import crypto from "node:crypto";

const BASE_URL = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as T & { message?: string; status?: boolean };
  if (!response.ok || (body && "status" in body && body.status === false)) {
    throw new Error(body?.message || `Paystack request failed (${response.status})`);
  }
  return body;
}

export async function initializePaystack(input: {
  email: string;
  amountMinor: bigint;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  return request<{ status: boolean; data: { authorization_url: string; access_code: string; reference: string } }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountMinor.toString(),
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: JSON.stringify(input.metadata ?? {}),
    }),
  });
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const key = secretKey();
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  return signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function verifyPaystackTransaction(reference: string) {
  if (!reference) throw new Error("Paystack reference is required");
  return request<{ status: boolean; data: {
    id: number; status: string; reference: string; amount: number; currency: string;
    paid_at?: string; channel?: string; gateway_response?: string;
  } }>(`/transaction/verify/${encodeURIComponent(reference)}`);
}
