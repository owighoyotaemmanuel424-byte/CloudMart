"use client";

import { useEffect, useState } from "react";

type Service = { slug: string; name: string; category?: string };
type Me = { authenticated: boolean; user?: { name?: string | null; email: string } | null };
type Wallet = { balanceMinor: string; currency: string };
type Order = { id: string; status: string; amountMinor: string; service: Service; createdAt: string };

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [wallet, setWallet] = useState<Wallet>({ balanceMinor: "0", currency: "NGN" });
  const [orders, setOrders] = useState<Order[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r => r.json()),
      fetch("/api/services").then(r => r.ok ? r.json() : { services: [] }),
    ]).then(([m, s]) => { setMe(m); setServices(s.services ?? []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!me?.authenticated) return;
    Promise.all([
      fetch("/api/wallet").then(r => r.ok ? r.json() : null),
      fetch("/api/orders/mine").then(r => r.ok ? r.json() : null),
    ]).then(([w, o]) => { if (w?.wallet) setWallet(w.wallet); if (o?.orders) setOrders(o.orders); });
  }, [me?.authenticated]);

  async function register() {
    const r = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name }) });
    if (r.ok) location.reload();
  }

  if (loading) return <main className="shell"><div className="loading">Loading CloudMart…</div></main>;

  return <main className="shell">
    <header className="top"><div><b>CLOUDMART</b><span>Digital services marketplace</span></div>{me?.authenticated && <button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});location.reload()}}>Sign out</button>}</header>
    {!me?.authenticated ? <section className="auth card"><h1>Everything digital, in one place.</h1><p>Connect once. Buy digital services from a unified marketplace.</p><div className="fields"><input placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/><button onClick={register}>Create account</button></div></section> :
    <>
      <section className="hero"><div><small>Available balance</small><h1>₦{(Number(wallet.balanceMinor)/100).toLocaleString("en-NG",{minimumFractionDigits:2})}</h1><p>{me.user?.name || me.user?.email}</p></div><div className="pill">{wallet.currency}</div></section>
      <h2>Marketplace</h2><div className="grid">{services.map(s=><article className="card" key={s.slug}><span className="tag">{s.category || "Digital"}</span><h3>{s.name}</h3><p>Available through Globalgle</p><button>View service</button></article>)}</div>
      <h2>Recent orders</h2><div className="orders">{orders.length ? orders.map(o=><div className="order" key={o.id}><div><b>{o.service.name}</b><small>{new Date(o.createdAt).toLocaleString()}</small></div><strong>{o.status}</strong></div>) : <div className="card">No orders yet.</div>}</div>
    </>}
  </main>;
}
