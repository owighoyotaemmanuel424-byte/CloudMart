"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/orders/${encodeURIComponent(id)}`)
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "Unable to load order"); return body.order; })
      .then(setOrder)
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load order"));
  }, [id]);

  if (error) return <main className="shell"><div className="card error">{error}</div></main>;
  if (!order) return <main className="shell"><div className="card">Loading order…</div></main>;

  return <main className="shell">
    <header className="top"><a href="/dashboard">← Dashboard</a><b>ORDER</b></header>
    <section className="hero"><div><small>Order status</small><h1>{order.status}</h1><p>{order.service.name}</p></div><div className="pill">₦{(Number(order.amountMinor)/100).toLocaleString("en-NG",{minimumFractionDigits:2})}</div></section>
    <section className="card"><h2>Order details</h2><p><b>Order ID</b><br/>{order.id}</p><p><b>Provider</b><br/>{order.provider}</p>{order.providerOrderId && <p><b>Provider reference</b><br/>{order.providerOrderId}</p>}</section>
    <section className="card"><h2>Timeline</h2>{order.events.map((event:any)=><div className="order" key={event.id}><div><b>{event.type}</b><small>{new Date(event.createdAt).toLocaleString()}</small></div></div>)}</section>
  </main>;
}
