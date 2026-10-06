"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Section = {
  id: string;
  label: string;
  description: string;
  group: string;
  supported?: boolean;
};

const sections: Section[] = [
  {id:"dashboard",label:"Dashboard",description:"Live operating overview",group:"Overview",supported:true},
  {id:"analytics",label:"Analytics",description:"Performance and status trends",group:"Overview",supported:true},
  {id:"reports",label:"Reports",description:"Operational summaries",group:"Overview",supported:true},
  {id:"transactions",label:"Transactions",description:"Wallet and financial activity",group:"Money",supported:true},
  {id:"orders",label:"Orders",description:"Customer order queue",group:"Commerce",supported:true},
  {id:"reconciliation",label:"Reconcile",description:"Ambiguous and stale orders",group:"Commerce",supported:true},
  {id:"services",label:"Services & markup",description:"Catalog and provider products",group:"Commerce",supported:true},
  {id:"users",label:"Customers",description:"Customer accounts and wallets",group:"People",supported:true},
  {id:"float",label:"Float",description:"Wallet liability overview",group:"Money",supported:true},
  {id:"deposits",label:"Deposits",description:"Paystack wallet funding",group:"Money",supported:true},
  {id:"ledger",label:"Wallet ledger",description:"Immutable wallet entries",group:"Money",supported:true},
  {id:"revenue",label:"Revenue",description:"Completed order revenue",group:"Money",supported:true},
  {id:"webhooks",label:"Webhooks",description:"Provider event processing",group:"Operations",supported:true},
  {id:"health",label:"Health",description:"Provider and database status",group:"Operations",supported:true},
  {id:"audit",label:"Audit log",description:"Administrative activity",group:"Security",supported:true},
  {id:"login-history",label:"Login history",description:"Admin access events",group:"Security",supported:true},
  {id:"settings",label:"Settings",description:"Reconciliation controls",group:"System",supported:true},
  {id:"roles",label:"Roles & admins",description:"Admin access management",group:"Security"},
  {id:"crons",label:"Cron jobs",description:"Scheduled jobs and runs",group:"Operations"},
  {id:"withdrawals",label:"Withdrawals",description:"Withdrawal operations",group:"Money"},
  {id:"refunds",label:"Refunds",description:"Refund operations",group:"Money"},
  {id:"gift-cards",label:"Gift cards",description:"Gift-card catalog",group:"Products"},
  {id:"social",label:"Social boosting",description:"Social services",group:"Products"},
  {id:"promotions",label:"Promotions",description:"Campaigns and offers",group:"Products"},
  {id:"tickets",label:"Tickets",description:"Customer support",group:"Support"},
  {id:"announcements",label:"Announcements",description:"Customer announcements",group:"Support"},
  {id:"templates",label:"Templates",description:"Message templates",group:"Support"},
  {id:"notifications",label:"Notifications",description:"Outbound notifications",group:"Support"},
  {id:"api-keys",label:"API keys",description:"Integration credentials",group:"System"},
  {id:"system-logs",label:"System logs",description:"Application logs",group:"System"},
];

const money=(v:any)=>`₦${(Number(v||0)/100).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date=(v:any)=>v?new Date(v).toLocaleString():"—";

export default function AdminConsole({initialSection="dashboard"}:{initialSection?:string}){
  const pathname=usePathname();
  const [section,setSection]=useState(initialSection);
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("");
  const [page,setPage]=useState(1);
  const [mobileOpen,setMobileOpen]=useState(false);

  useEffect(()=>{ const fromPath=pathname?.split("/")[2]; if(fromPath) setSection(fromPath==="admin"?"dashboard":fromPath); },[pathname]);
  useEffect(()=>{ setPage(1);setSearch("");setStatus(""); },[section]);
  useEffect(()=>{ load(section,page); },[section,page]);

  async function load(target=section,p=page){
    setLoading(true);setError("");
    try{
      if(target==="settings"){
        const r=await fetch("/api/admin/settings/reconciliation",{cache:"no-store"});
        const b=await r.json();if(!r.ok) throw new Error(b.error||"Unable to load settings");setData(b);return;
      }
      const q=new URLSearchParams({section:target,page:String(p),take:"30"});
      if(search) q.set("search",search);
      if(status) q.set("status",status);
      const r=await fetch("/api/admin/operations?"+q,{cache:"no-store"});
      const b=await r.json();if(r.status===403){setError("Admin access required.");setData(null);return}
      if(!r.ok) throw new Error(b.error||"Unable to load admin data");
      setData(b);
    }catch(e){setData(null);setError(e instanceof Error?e.message:"Unable to load admin data")}
    finally{setLoading(false)}
  }

  const current=sections.find(x=>x.id===section)??sections[0];
  const groups=useMemo(()=>Array.from(new Set(sections.map(x=>x.group))),[]);
  const go=(id:string)=>{setSection(id);setMobileOpen(false);if(id==="dashboard") window.history.replaceState(null,"","/admin");else window.history.replaceState(null,"",`/admin/${id}`)};

  return <main className="admin-app">
    <aside className={"admin-sidebar "+(mobileOpen?"open":"")}>
      <div className="admin-brand"><span className="admin-logo">C</span><div><b>CLOUDMART</b><small>Admin Console</small></div><button className="sidebar-close" onClick={()=>setMobileOpen(false)}>×</button></div>
      <div className="admin-nav">
        {groups.map(group=><div className="nav-group" key={group}><small>{group}</small>{sections.filter(x=>x.group===group).map(item=><button key={item.id} className={section===item.id?"active":""} onClick={()=>go(item.id)}><span className="nav-icon">{icon(item.id)}</span><span>{item.label}</span>{item.supported===false&&<i>•</i>}</button>)}</div>)}
      </div>
      <div className="sidebar-footer"><Link href="/dashboard">← Customer app</Link><Link href="/admin/login">Sign out / switch admin</Link></div>
    </aside>
    {mobileOpen&&<button className="admin-overlay" onClick={()=>setMobileOpen(false)} aria-label="Close menu"/>}
    <section className="admin-main">
      <header className="admin-topbar">
        <button className="mobile-menu" onClick={()=>setMobileOpen(true)}>☰</button>
        <div className="admin-breadcrumb"><span>CloudMart</span><b>/</b><strong>{current.label}</strong></div>
        <div className="admin-top-actions"><button onClick={()=>load(section,page)}>↻ Refresh</button><Link href="/admin/login">Admin access</Link></div>
      </header>
      <div className="admin-content">
        <div className="page-heading"><div><span className="eyebrow">ADMIN / {current.group.toUpperCase()}</span><h1>{current.label}</h1><p>{current.description}</p></div><div className="live-indicator"><span/> Live database</div></div>
        {error&&<div className="admin-alert">{error}{error==="Admin access required."&&<Link href="/admin/login">Sign in →</Link>}</div>}
        {loading&&!data?<Loading/>:!error&&data&&<SectionView section={section} data={data} search={search} setSearch={setSearch} status={status} setStatus={setStatus} page={page} setPage={setPage} reload={()=>load(section,page)}/>}
        {!loading&&!data&&!error&&<Empty title="No data returned" text="The admin endpoint returned no records for this section."/>}
      </div>
    </section>
  </main>
}

function SectionView({section,data,search,setSearch,status,setStatus,page,setPage,reload}:any){
  if(["dashboard","analytics","reports"].includes(section)) return <Overview section={section} data={data}/>;
  if(section==="settings") return <Settings data={data} reload={reload}/>;
  if(section==="health") return <Health data={data}/>;
  if(["roles","crons","withdrawals","refunds","gift-cards","social","promotions","tickets","announcements","templates","notifications","api-keys","system-logs"].includes(section))
    return <Unavailable section={section}/>;
  const rows=data.rows||[];
  return <section className="admin-panel">
    <Toolbar search={search} setSearch={setSearch} status={status} setStatus={setStatus} section={section} reload={reload}/>
    {section==="float"&&<Float data={data}/>}
    {section==="revenue"&&<Revenue data={data}/>}
    {section==="services"&&<Services rows={rows}/>}
    {section==="webhooks"&&<Webhooks rows={rows}/>}
    {section==="audit"&&<Audit rows={rows}/>}
    {section==="login-history"&&<Audit rows={rows}/>}
    {section==="deposits"&&<Deposits rows={rows}/>}
    {section==="orders"&&<Orders rows={rows}/>}
    {section==="reconciliation"&&<Reconciliation rows={rows} staleMinutes={data.staleMinutes}/>}
    {section==="ledger"&&<Ledger rows={rows}/>}
    {section==="transactions"&&<Ledger rows={rows}/>}
    {section==="users"&&<Users rows={rows}/>}
    <Pager page={data.page||1} total={data.total||0} take={data.take||30} onChange={p=>setPage(p)}/>
  </section>
}

function Overview({section,data}:any){
 const m=data.metrics||{};
 return <><div className="admin-kpis">{Object.entries(m).map(([k,v])=><div className="admin-kpi" key={k}><span>{labelize(k)}</span><strong>{String(v)}</strong><small>Live database metric</small></div>)}</div>
 <div className="admin-grid-2"><Panel title={section==="analytics"?"Status snapshot":"Recent deposits"}><MiniList rows={data.recentDeposits||[]} kind="deposit"/></Panel><Panel title={section==="reports"?"Recent orders":"Recent orders"}><MiniList rows={data.recentOrders||[]} kind="order"/></Panel></div>
 <Panel title="Admin modules"><div className="module-grid">{sections.filter(x=>x.supported).slice(0,16).map(x=><button key={x.id} onClick={()=>window.location.assign(x.id==="dashboard"?"/admin":`/admin/${x.id}`)}><b>{x.label}</b><small>{x.description}</small></button>)}</div></Panel></>
}

function Toolbar({search,setSearch,status,setStatus,section,reload}:any){
 const statuses=section==="orders"?["PENDING","PROCESSING","COMPLETED","FAILED","REFUNDED","CANCELLED"]:section==="deposits"?["PENDING","CREDITED","FAILED"]:[""];
 return <div className="admin-toolbar-2"><div><strong>Records</strong><small>Search and filter live data</small></div><div className="admin-controls"><input placeholder="Search email, ID, reference…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&reload()}/>{statuses.length>1&&<select value={status} onChange={e=>{setStatus(e.target.value);setTimeout(reload,0)}}><option value="">All statuses</option>{statuses.map((x:string)=><option key={x}>{x}</option>)}</select>}<button onClick={reload}>Apply</button></div></div>
}

function Deposits({rows}:any){return <Table headers={["Reference","Customer","Amount","Provider","Status","Created"]}>{rows.map((x:any)=><tr key={x.id}><td><b>{x.reference}</b><small>{x.providerReference||"Awaiting provider reference"}</small></td><td>{x.user.email}</td><td>{money(x.amountMinor)} {x.currency}</td><td>{x.paymentProvider||"—"}</td><td><Status v={x.status}/></td><td>{date(x.createdAt)}</td></tr>)}</Table>}
function Orders({rows}:any){return <Table headers={["Order","Customer","Service","Amount","Provider","Status","Updated"]}>{rows.map((x:any)=><tr key={x.id}><td><Link href={`/admin/orders/${x.id}`}><b>{x.id}</b></Link><small>{x.providerOrderId||"No provider ref"}</small></td><td>{x.user.email}</td><td>{x.service.name}<small>{x.service.category}</small></td><td>{money(x.amountMinor)} {x.currency}</td><td>{x.provider}</td><td><Status v={x.status}/></td><td>{date(x.updatedAt)}</td></tr>)}</Table>}
function Ledger({rows}:any){return <Table headers={["Reference","Customer","Type","Amount","Description","Created"]}>{rows.map((x:any)=><tr key={x.id}><td><b>{x.reference}</b></td><td>{x.user.email}</td><td><Status v={x.type}/></td><td>{money(x.amountMinor)} {x.currency}</td><td>{x.description}</td><td>{date(x.createdAt)}</td></tr>)}</Table>}
function Users({rows}:any){return <Table headers={["Customer","Role","Wallet","Orders","Deposits","Joined"]}>{rows.map((x:any)=><tr key={x.id}><td><b>{x.email}</b><small>{x.name||"No name"}</small></td><td><Status v={x.role}/></td><td>{money(x.wallet?.balanceMinor)} {x.wallet?.currency||"NGN"}</td><td>{x._count.orders}</td><td>{x._count.deposits}</td><td>{date(x.createdAt)}</td></tr>)}</Table>}
function Services({rows}:any){return <Table headers={["Service","Category","Status","Products","Orders","Updated"]}>{rows.map((x:any)=><tr key={x.id}><td><b>{x.name}</b><small>{x.slug}</small></td><td>{x.category}</td><td><Status v={x.enabled?"ENABLED":"DISABLED"}/></td><td>{x._count.products}</td><td>{x._count.orders}</td><td>{date(x.updatedAt)}</td></tr>)}</Table>}
function Webhooks({rows}:any){return <Table headers={["Provider","Event","External ID","Processing","Created"]}>{rows.map((x:any)=><tr key={x.id}><td>{x.provider}</td><td><b>{x.eventType}</b></td><td>{x.externalId}</td><td><Status v={x.processedAt?"PROCESSED":x.processingAt?"PROCESSING":"PENDING"}/></td><td>{date(x.createdAt)}</td></tr>)}</Table>}
function Audit({rows}:any){return <Table headers={["Action","Resource","Actor","Metadata","Created"]}>{rows.map((x:any)=><tr key={x.id}><td><b>{x.action}</b></td><td>{x.resource}</td><td>{x.actorId||"system"}</td><td><small>{JSON.stringify(x.metadata||{})}</small></td><td>{date(x.createdAt)}</td></tr>)}</Table>}
function Reconciliation({rows,staleMinutes}:any){return <><div className="admin-alert soft">Orders remain PROCESSING until provider evidence is available. Stale threshold: <b>{staleMinutes??15} minutes.</b></div><Table headers={["Order","Customer","Service","Provider ref","Reason","Age","Review"]}>{rows.map((x:any)=><tr key={x.id}><td><Link href={`/admin/orders/${x.id}`}><b>{x.id}</b></Link></td><td>{x.user.email}</td><td>{x.service.name}</td><td>{x.providerOrderId||"Awaiting reference"}</td><td><Status v={x.stale?"STALE":"AMBIGUOUS"}/></td><td>{x.ageMinutes} min</td><td><Link className="mini-button" href={`/admin/orders/${x.id}`}>Review</Link></td></tr>)}</Table></>}
function Float({data}:any){return <div className="admin-kpis compact"><div className="admin-kpi"><span>Total wallet balance</span><strong>{money(data.totalBalanceMinor)}</strong><small>Customer liability</small></div><div className="admin-kpi"><span>Wallets</span><strong>{data.wallets}</strong><small>Active wallet records</small></div><div className="admin-kpi"><span>Negative wallets</span><strong>{data.negativeWallets}</strong><small>Requires attention</small></div></div>}
function Revenue({data}:any){return <div className="admin-kpis"><div className="admin-kpi"><span>Completed order value</span><strong>{money(data.completedAmountMinor)}</strong><small>{data.completedOrders} completed orders</small></div><div className="admin-kpi"><span>Credits</span><strong>{money(data.creditMinor)}</strong><small>Wallet ledger credits</small></div><div className="admin-kpi"><span>Debits</span><strong>{money(data.debitMinor)}</strong><small>Wallet ledger debits</small></div><div className="admin-kpi"><span>Refunds</span><strong>{money(data.refundMinor)}</strong><small>Wallet refunds</small></div></div>}
function Health({data}:any){return <div className="health-grid"><HealthCard title="CloudMart API" ok={data.ok} detail={data.timestamp}/><HealthCard title="Globalgle provider" ok={data.globalgle?.ok} detail={data.globalgle?.message||`HTTP ${data.globalgle?.status||0}`}/><HealthCard title="Database" ok={data.database?.ok} detail={data.database?.message||"PostgreSQL reachable"}/></div>}
function HealthCard({title,ok,detail}:any){return <div className="health-card"><span className={ok?"healthy":"unhealthy"}>{ok?"●":"●"}</span><div><b>{title}</b><small>{ok?"Healthy":"Attention required"} · {detail||"—"}</small></div></div>}
function Settings({data,reload}:any){const[v,setV]=useState(String(data.staleMinutes??15));const[saving,setSaving]=useState(false);const[note,setNote]=useState("");async function save(){setSaving(true);setNote("");const r=await fetch("/api/admin/settings/reconciliation",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({staleMinutes:v})});const b=await r.json();setSaving(false);if(!r.ok){setNote(b.error||"Unable to save");return}setV(String(b.staleMinutes));setNote("Saved successfully.");reload()}return <div className="settings-grid"><Panel title="Reconciliation"><p>Control when PROCESSING orders appear in the manual reconciliation queue.</p><label className="field"><span>Stale threshold (minutes)</span><input type="number" min={5} max={1440} value={v} onChange={e=>setV(e.target.value)}/><small>Allowed range: 5–1440 minutes.</small></label><button className="primary-action" disabled={saving} onClick={save}>{saving?"Saving…":"Save setting"}</button>{note&&<div className="admin-alert soft">{note}</div>}</Panel><Panel title="Deployment configuration"><ConfigRow name="Default markup" value={"Server-side configuration"}/><ConfigRow name="Provider" value="Globalgle / Tudowebs adapter"/><ConfigRow name="Payments" value="Paystack wallet funding"/><ConfigRow name="Database" value="PostgreSQL + Prisma"/></Panel></div>}
function ConfigRow({name,value}:{name:string,value:string}){return <div className="config-row"><span>{name}</span><b>{value}</b></div>}
function Unavailable({section}:{section:string}){const item=sections.find(x=>x.id===section);return <div className="empty-state"><div className="empty-icon">◌</div><h2>{item?.label} workspace</h2><p>{item?.description} is not backed by a database model in the current CloudMart schema, so this page does not show fabricated records.</p><span>UI route is ready · data model/action layer pending</span></div>}
function MiniList({rows,kind}:any){return <div className="mini-list">{rows.length?rows.map((x:any)=><div key={x.id}><div><b>{kind==="deposit"?money(x.amountMinor):x.service?.name}</b><small>{x.user?.email||x.reference}</small></div><Status v={x.status}/></div>):<p className="muted">No recent records.</p>}</div>}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="admin-panel inner"><div className="panel-heading"><h2>{title}</h2></div>{children}</section>}
function Table({headers,children}:{headers:string[];children:React.ReactNode}){return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
function Status({v}:{v:any}){return <span className={"status-chip "+String(v||"unknown").toLowerCase().replaceAll("_","-")}>{String(v||"—")}</span>}
function Pager({page,total,take,onChange}:{page:number;total:number;take:number;onChange:(p:number)=>void}){const pages=Math.max(1,Math.ceil(total/take));return <div className="pager-2"><span>{total} records · Page {page} of {pages}</span><div><button disabled={page<=1} onClick={()=>onChange(page-1)}>Previous</button><button disabled={page>=pages} onClick={()=>onChange(page+1)}>Next</button></div></div>}
function Loading(){return <div className="admin-loading"><span/>Loading live admin data…</div>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty-state"><div className="empty-icon">—</div><h2>{title}</h2><p>{text}</p></div>}
function labelize(v:string){return v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}
function icon(id:string){const m:any={dashboard:"⌂",analytics:"⌁",reports:"▤",transactions:"↔",orders:"◈",reconciliation:"✓",services:"◫",users:"♙",float:"◉",deposits:"＋",ledger:"≡",revenue:"₦",webhooks:"↯",health:"♥",audit:"◌","login-history":"◷",settings:"⚙",roles:"♟",crons:"◷",withdrawals:"↗",refunds:"↩","gift-cards":"◇",social:"◎",promotions:"✦",tickets:"?",announcements:"!",templates:"▧",notifications:"●","api-keys":"⌘","system-logs":"≣"};return m[id]||"•"}
