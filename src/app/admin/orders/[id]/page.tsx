"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const money=(v:string)=>`₦${(Number(v)/100).toLocaleString("en-NG",{minimumFractionDigits:2})}`;
const date=(v:string)=>new Date(v).toLocaleString();

export default function AdminOrderDetail({params}:{params:Promise<{id:string}>}){
 const [id,setId]=useState(""),[data,setData]=useState<any>(null),[error,setError]=useState("");
 useEffect(()=>{params.then(p=>setId(p.id))},[params]);
 useEffect(()=>{if(!id)return;fetch("/api/admin/orders/"+encodeURIComponent(id)).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error||"Unable to load order");return b}).then(setData).catch(e=>setError(e.message))},[id]);
 if(error)return <main className="shell"><div className="notice error">{error}</div><Link className="button" href="/admin">Back to admin</Link></main>;
 if(!data)return <main className="shell loading">Loading order…</main>;
 const o=data.order;
 return <main className="shell admin-shell">
  <header className="top"><div><b>ORDER RECONCILIATION</b><span>{o.id}</span></div><Link className="button" href="/admin">← Admin</Link></header>
  <section className="hero"><div><small>{o.service.name} · {o.service.category}</small><h1>{money(o.amountMinor)}</h1><p>{o.user.email}</p></div><span className={"status "+o.status.toLowerCase()}>{o.status}</span></section>
  <section className="grid admin-metrics">
   <div className="card"><small>Provider</small><h3>{o.provider}</h3><p>Provider order: {o.providerOrderId||"Not assigned"}</p></div>
   <div className="card"><small>Created</small><h3>{date(o.createdAt)}</h3><p>Updated {date(o.updatedAt)}</p></div>
   <div className="card"><small>Customer</small><h3>{o.user.name||"No name"}</h3><p>{o.user.email}</p></div>
   <div className="card"><small>Refund protection</small><h3>{o.status==="REFUNDED"?"Refunded":"Ledger-backed"}</h3><p>Refund reference is unique and idempotent.</p></div>
  </section>
  <section className="admin-two">
   <div className="card"><h2>Order timeline</h2><div className="timeline">{o.events.map((e:any)=><div className="timeline-item" key={e.id}><span></span><div><b>{e.type.replaceAll("_"," ")}</b><small>{date(e.createdAt)}</small></div></div>)}</div></div>
   <div className="card"><h2>Webhook reconciliation</h2>{o.webhookEvents?.length?<div className="timeline">{o.webhookEvents.map((e:any)=><div className="timeline-item" key={e.id}><span></span><div><b>{e.eventType}</b><small>{date(e.createdAt)} · {e.processedAt?"processed":"pending"}</small></div></div>)}</div>:<p>No matching provider webhook events were found.</p>}</div>
  </section>
  <section className="card"><h2>Provider response</h2><pre className="json-view">{JSON.stringify(o.responseSnapshot||{},null,2)}</pre></section>
 </main>;
}
