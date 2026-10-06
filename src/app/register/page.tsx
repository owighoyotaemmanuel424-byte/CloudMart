"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const response=await fetch("/api/auth/register",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({name,email,password}),
      });
      const body=await response.json();
      if(!response.ok){setMessage(body.error||"Unable to create account.");return;}
      window.location.href="/dashboard";
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{minHeight:"100vh",background:"#f7f7f5",padding:"28px 18px",color:"#111"}}>
      <nav style={{maxWidth:900,margin:"0 auto 70px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Link href="/" style={{fontWeight:800,textDecoration:"none",color:"#111"}}>CLOUDMART</Link>
        <Link href="/login">Already have an account? Sign in</Link>
      </nav>
      <section style={{maxWidth:520,margin:"0 auto",background:"#fff",border:"1px solid #ddd",borderRadius:24,padding:"34px"}}>
        <span style={{fontSize:11,fontWeight:800,letterSpacing:".08em",color:"#777"}}>CREATE ACCOUNT</span>
        <h1 style={{fontSize:48,lineHeight:1,letterSpacing:"-.05em",margin:"14px 0"}}>Start using CloudMart.</h1>
        <p style={{color:"#6d7072",lineHeight:1.6}}>Create a secure account for your wallet, marketplace purchases and order history.</p>
        <form onSubmit={submit} style={{display:"grid",gap:16,marginTop:28}}>
          <label style={{display:"grid",gap:7}}>Name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your name" style={{padding:13,border:"1px solid #d8dad7",borderRadius:10}}/></label>
          <label style={{display:"grid",gap:7}}>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" style={{padding:13,border:"1px solid #d8dad7",borderRadius:10}}/></label>
          <label style={{display:"grid",gap:7}}>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" style={{padding:13,border:"1px solid #d8dad7",borderRadius:10}}/><small style={{color:"#777"}}>Use at least 8 characters with a letter and a number.</small></label>
          <button disabled={busy} style={{border:0,borderRadius:11,padding:14,background:"#111",color:"#fff",fontWeight:800,cursor:"pointer"}}>{busy?"Creating…":"Create account →"}</button>
          {message&&<p style={{color:"#a33",fontSize:13}}>{message}</p>}
        </form>
      </section>
    </main>
  );
}
