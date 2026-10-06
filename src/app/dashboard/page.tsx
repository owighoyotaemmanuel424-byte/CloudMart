"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Service = { slug: string; name: string; category?: string };
type Me = { authenticated: boolean; user?: { name?: string | null; email: string } | null };
type Wallet = { balanceMinor: string; currency: string };
type Order = { id: string; status: string; amountMinor: string; service: Service; createdAt: string };
type Deposit = { id: string; amountMinor: string; currency: string; reference: string; status: string; paymentProvider?: string | null; createdAt: string; };

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [wallet, setWallet] = useState<Wallet>({ balanceMinor: "0", currency: "NGN" });
  const [orders, setOrders] = useState<Order[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [deposit, setDeposit] = useState("");
  const [message, setMessage] = useState("");
  const [depositStatus, setDepositStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("deposit");
    if (paymentStatus) setDepositStatus(paymentStatus);

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
    const r = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name, password }) });
    if (r.ok) location.reload();
  }

  async function createDepositIntent() {
    const minor = Math.round(Number(deposit) * 100);
    if (!Number.isFinite(minor) || minor < 100) { setMessage("Enter at least ₦1.00."); return; }
    const r = await fetch("/api/wallet/deposit-intents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amountMinor: String(minor) }) });
    const body = await r.json();
    if (r.ok && body.payment?.authorization_url) {
      window.location.href = body.payment.authorization_url;
      return;
    }
    setMessage(r.ok ? `Deposit intent created: ${body.intent.reference}.` : body.error || "Unable to create deposit intent");
  }

  if (loading) return <main className="shell"><div className="loading">Loading CloudMart…</div></main>;

  return <main className="shell">
    <header className="top"><div><b>CLOUDMART</b><span>Digital services marketplace</span></div>{me?.authenticated && <button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});location.reload()}}>Sign out</button>}</header>
    {!me?.authenticated ? <section className="auth card"><h1>Everything digital, in one place.</h1><p>Connect once. Buy digital services from a unified marketplace.</p><div className="fields"><input placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" autoComplete="new-password" placeholder="Password (8+ chars, letter + number)" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={register}>Create account</button></div></section> :
    <>
      <section className="hero"><div><small>Available balance</small><h1>₦{(Number(wallet.balanceMinor)/100).toLocaleString("en-NG",{minimumFractionDigits:2})}</h1><p>{me.user?.name || me.user?.email}</p></div><div className="pill">{wallet.currency}</div></section>
      <section className="card funding"><h2>Fund wallet</h2>{depositStatus && <p className="notice">Payment status: <b>{depositStatus}</b>. Wallet balance updates only after verified payment confirmation.</p>}<p>Create a secure deposit intent. No balance is credited until a payment provider confirms it.</p><div className="inline"><input inputMode="decimal" placeholder="Amount in NGN" value={deposit} onChange={e=>setDeposit(e.target.value)}/><button onClick={createDepositIntent}>Continue</button></div>{message && <p className="notice">{message}</p>}</section>
      <h2>Marketplace</h2><div className="grid">{services.map(s=><article className="card" key={s.slug}><span className="tag">{s.category || "Digital"}</span><h3>{s.name}</h3><p>Live service catalog through Globalgle.</p><Link className="button" href={`/services/${encodeURIComponent(s.slug)}`}>View service</Link></article>)}</div>
      <h2>Wallet deposits</h2><div className="orders">{deposits.length ? deposits.map(d=><div className="order" key={d.id}><div><b>₦{(Number(d.amountMinor)/100).toLocaleString("en-NG",{minimumFractionDigits:2})} deposit</b><small>{d.reference} · {new Date(d.createdAt).toLocaleString()}</small></div><strong className={`status ${d.status.toLowerCase()}`}>{d.status}</strong></div>) : <div className="card">No wallet deposits yet.</div>}</div>
      <h2>Recent orders</h2><div className="orders">{orders.length ? orders.map(o=><Link className="order" href={`/orders/${o.id}`} key={o.id}><div><b>{o.service.name}</b><small>{new Date(o.createdAt).toLocaleString()}</small></div><strong>{o.status}</strong></Link>) : <div className="card">No orders yet.</div>}</div>
    </>}
  </main>;
}
