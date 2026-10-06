"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Service = {
  slug: string;
  name: string;
  category?: string;
  requiredFields?: string[];
  pricing: { providerAmount: string; providerCurrency: string; sellMinor: string } | null;
};

export default function ServicePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [request, setRequest] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Loading service…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/services/${encodeURIComponent(params.slug)}`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load service");
        setService(body.service);
        const initial: Record<string, string> = {};
        for (const field of body.service.requiredFields ?? []) initial[field] = "";
        setRequest(initial);
        setMessage("");
      })
      .catch(error => setMessage(error instanceof Error ? error.message : "Unable to load service"));
  }, [params.slug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!service?.pricing) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceSlug: service.slug,
        request,
        idempotencyKey: `web-${crypto.randomUUID()}`,
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error === "pricing_unavailable" ? "This service is temporarily unavailable for purchase." : body.error || "Checkout failed");
      return;
    }
    router.push(`/orders/${body.orderId}`);
  }

  if (!service) return <main className="shell"><div className="card">{message}</div></main>;

  const amount = Number(service.pricing?.sellMinor ?? "0") / 100;
  return <main className="shell">
    <header className="top"><a href="/dashboard">← Marketplace</a><b>CLOUDMART</b></header>
    <section className="card service-detail">
      <span className="tag">{service.category || "Digital"}</span>
      <h1>{service.name}</h1>
      <p>Secure checkout through CloudMart and Globalgle.</p>
      {service.pricing ? <div className="price">₦{amount.toLocaleString("en-NG",{minimumFractionDigits:2})}</div> : <div className="notice">Live pricing is not available for this service yet.</div>}
      <form onSubmit={submit}>
        {(service.requiredFields ?? []).map(field => <label key={field}>{field}<input required value={request[field] ?? ""} onChange={e => setRequest(current => ({ ...current, [field]: e.target.value }))} placeholder={field}/></label>)}
        <button disabled={busy || !service.pricing}>{busy ? "Processing…" : "Buy service"}</button>
      </form>
      {message && <p className="error">{message}</p>}
    </section>
  </main>;
}
