export default function Home() {
  return (
    <main style={{fontFamily:"system-ui",maxWidth:960,margin:"0 auto",padding:"64px 24px"}}>
      <p style={{fontWeight:700}}>CLOUDMART</p>
      <h1 style={{fontSize:"clamp(40px,7vw,72px)",lineHeight:1.02,margin:"24px 0 16px"}}>Digital services, one marketplace.</h1>
      <p style={{fontSize:20,lineHeight:1.6,maxWidth:720,color:"#555"}}>
        A provider-agnostic digital services platform with Globalgle connected securely on the server.
      </p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginTop:40}}>
        {["Service catalog","Wallet & ledger","Orders & tracking","Admin controls"].map(x=><div key={x} style={{border:"1px solid #ddd",borderRadius:18,padding:24}}><strong>{x}</strong></div>)}
      </div>
    </main>
  );
}
