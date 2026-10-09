"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";

type Service = {
  slug: string;
  name: string;
  category?: string;
  description?: string;
  providerId?: string;
  requiredFields?: string[];
  pricing: { sellMinor: string; currency: string } | null;
};

const label = (value: string) =>
  value.replace(/[-_]+/g, " ").replace(/\b\w/g, character => character.toUpperCase());

export default function ServicePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [request, setRequest] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Loading live product…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/services/" + encodeURIComponent(params.slug), { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load live product");
        setService(body.service);
        const initial: Record<string, string> = {};
        for (const field of body.service.requiredFields ?? []) initial[field] = "";
        setRequest(initial);
        setMessage("");
      })
      .catch(error => setMessage(error instanceof Error ? error.message : "Unable to load live product"));
  }, [params.slug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!service?.pricing) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceSlug: service.slug,
          request,
          idempotencyKey: "web-" + crypto.randomUUID(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(
          body.error === "pricing_unavailable"
            ? "This product is temporarily unavailable for purchase."
            : body.error || "Checkout failed",
        );
        return;
      }
      router.push(("/orders/" + body.orderId) as Route);
    } catch {
      setMessage("Checkout could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!service) {
    return (
      <main className="shell">
        <div className="card">{message}</div>
      </main>
    );
  }

  const amount = Number(service.pricing?.sellMinor ?? "0") / 100;

  return (
    <main className="shell">
      <header className="top">
        <Link href="/catalog">← Marketplace</Link>
        <b>CLOUDMART</b>
      </header>

      <section className="card service-detail">
        <div className="service-live-label">● LIVE TUDOWEBS PRODUCT</div>
        <span className="tag">{service.category || "Digital"}</span>
        <h1>{service.name}</h1>

        <p>
          {service.description ||
            "Real product supplied by Tudowebs and available through CloudMart."}
        </p>

        {service.providerId && (
          <div className="service-reference">
            <span>Provider product</span>
            <code>{service.providerId}</code>
          </div>
        )}

        {service.pricing ? (
          <div className="price">₦{amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
        ) : (
          <div className="notice">Live pricing is not available for this product yet.</div>
        )}

        <form onSubmit={submit}>
          {(service.requiredFields ?? []).map(field => (
            <label key={field}>
              {label(field)}
              <input
                required
                value={request[field] ?? ""}
                onChange={event =>
                  setRequest(current => ({ ...current, [field]: event.target.value }))
                }
                placeholder={label(field)}
                autoComplete="off"
              />
            </label>
          ))}

          {!service.requiredFields?.length && service.pricing && (
            <div className="service-ready">No extra product details are required.</div>
          )}

          <button disabled={busy || !service.pricing}>
            {busy ? "Processing…" : "Buy product"}
          </button>
        </form>

        {message && <p className="error">{message}</p>}
      </section>
    </main>
  );
}
