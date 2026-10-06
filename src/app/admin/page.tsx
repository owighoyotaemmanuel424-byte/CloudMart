"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [message, setMessage] = useState("Loading admin console…");
  async function load() {
    const [catalog, status] = await Promise.all([fetch("/api/admin/catalog").then(r=>r.json()), fetch("/api/admin/provider").then(r=>r.json())]);
    if (!catalog.ok) { setMessage(catalog.error === "forbidden" ? "Admin access required." : catalog.error || "Unable to load catalog"); return; }
    setData(catalog); setProvider(status); setMessage("");
  }
  useEffect(() => { load(); }, []);
  async function sync() {
    setMessage("Synchronizing Globalgle catalog…");
    const r = await fetch("/api/admin/catalog/sync", { method:"POST" });
    const body = await r.json();
    setMessage(r.ok ? `Catalog synced: ${body.services} services / ${body.products} products.` : body.error || "Sync failed");
    if (r.ok) load();
  }
  if (!data) return <main className="shell"><div className="card">{message}{message === "Admin access required." && <p><Link href="/admin/login">Open admin sign in →</Link></p>}</div></main>;
  return <main className="shell"><header className="top"><div><b>CLOUDMART ADMIN</b><span>Operations console</span></div><button onClick={sync}>Sync catalog</button></header>{message && <div className="notice">{message}</div>}<section className="grid"><div className="card"><small>Services</small><h1>{data.services.length}</h1><p>Synced marketplace services</p></div><div className="card"><small>Provider products</small><h1>{data.products.length}</h1><p>Globalgle products</p></div><div className="card"><small>Provider health</small><h2>{provider?.health?.ok ? "Healthy" : "Unavailable"}</h2><p>Globalgle API</p></div></section><section className="card"><h2>Services</h2>{data.services.map((s:any)=><div className="order" key={s.id}><div><b>{s.name}</b><small>{s.slug} · {s.category}</small></div><span>{s.enabled ? "Enabled" : "Disabled"}</span></div>)}</section></main>;
}
