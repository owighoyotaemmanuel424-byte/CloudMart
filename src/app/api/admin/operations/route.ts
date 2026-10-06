import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE,getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
const json=(x:any)=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==="bigint"?v.toString():v));
export async function GET(req:Request){
 const jar=await cookies(),u=await getSessionUser(jar.get(COOKIE)?.value);
 if(!u||u.role!=="ADMIN")return NextResponse.json({ok:false,error:"forbidden"},{status:403});
 const q=new URL(req.url).searchParams,s=q.get("section")||"overview",page=Math.max(1,Number(q.get("page")||1)),take=Math.min(100,Math.max(1,Number(q.get("take")||30))),skip=(page-1)*take,search=q.get("search")?.trim(),status=q.get("status")||undefined;
 if(s==="deposits"){const where:any={...(status?{status}:{}),...(search?{OR:[{reference:{contains:search,mode:"insensitive"}},{providerReference:{contains:search,mode:"insensitive"}},{user:{email:{contains:search,mode:"insensitive"}}}]}:{})};const [rows,total,summary]=await Promise.all([db.walletDeposit.findMany({where,orderBy:{createdAt:"desc"},skip,take,include:{user:{select:{id:true,email:true,name:true}}}}),db.walletDeposit.count({where}),db.walletDeposit.groupBy({by:["status"],_count:{_all:true},_sum:{amountMinor:true}})]);return NextResponse.json(json({ok:true,section:s,page,take,total,rows,summary}))}
 if(s==="reconciliation"){
  const staleMinutes = 15;
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000);
  const where:any={
    status:"PROCESSING",
    OR:[
      { createdAt:{lte:staleBefore} },
      { events:{some:{type:"provider_outcome_ambiguous"}} }
    ]
  };
  const [rows,total]=await Promise.all([
    db.order.findMany({where,orderBy:{createdAt:"asc"},skip,take,include:{user:{select:{id:true,email:true,name:true}},service:{select:{slug:true,name:true,category:true}},events:{where:{type:"provider_outcome_ambiguous"},orderBy:{createdAt:"desc"},take:3,select:{id:true,type:true,createdAt:true,payload:true}}}}),
    db.order.count({where})
  ]);
  const enriched=rows.map((row:any)=>({...row,ageMinutes:Math.max(0,Math.floor((Date.now()-new Date(row.createdAt).getTime())/60000)),stale:row.createdAt<=staleBefore}));
  return NextResponse.json(json({ok:true,section:s,page,take,total,staleMinutes,rows:enriched}));
 }
 if(s==="orders"){const where:any={...(status?{status}:{}),...(search?{OR:[{id:{contains:search,mode:"insensitive"}},{providerOrderId:{contains:search,mode:"insensitive"}},{user:{email:{contains:search,mode:"insensitive"}}},{service:{name:{contains:search,mode:"insensitive"}}}]}:{})};const [rows,total,summary]=await Promise.all([db.order.findMany({where,orderBy:{createdAt:"desc"},skip,take,include:{user:{select:{id:true,email:true,name:true}},service:{select:{slug:true,name:true,category:true}},events:{orderBy:{createdAt:"desc"},take:5,select:{id:true,type:true,createdAt:true}}}}),db.order.count({where}),db.order.groupBy({by:["status"],_count:{_all:true},_sum:{amountMinor:true}})]);return NextResponse.json(json({ok:true,section:s,page,take,total,rows,summary}))}
 if(s==="ledger"){const where:any=search?{OR:[{reference:{contains:search,mode:"insensitive"}},{user:{email:{contains:search,mode:"insensitive"}}},{description:{contains:search,mode:"insensitive"}}]}:{};const [rows,total]=await Promise.all([db.ledgerEntry.findMany({where,orderBy:{createdAt:"desc"},skip,take,include:{user:{select:{email:true,name:true}}}}),db.ledgerEntry.count({where})]);return NextResponse.json(json({ok:true,section:s,page,take,total,rows}))}
 if(s==="users"){const where:any=search?{OR:[{email:{contains:search,mode:"insensitive"}},{name:{contains:search,mode:"insensitive"}}]}:{};const [rows,total]=await Promise.all([db.user.findMany({where,orderBy:{createdAt:"desc"},skip,take,include:{wallet:{select:{balanceMinor:true,currency:true,updatedAt:true}},_count:{select:{orders:true,deposits:true}}}}),db.user.count({where})]);return NextResponse.json(json({ok:true,section:s,page,take,total,rows}))}
 const [users,deposits,orders,ledger,recentDeposits,recentOrders]=await Promise.all([db.user.count(),db.walletDeposit.count(),db.order.count(),db.ledgerEntry.count(),db.walletDeposit.findMany({orderBy:{createdAt:"desc"},take:8,include:{user:{select:{email:true}}}}),db.order.findMany({orderBy:{createdAt:"desc"},take:8,include:{user:{select:{email:true}},service:{select:{name:true}}}})]);
 return NextResponse.json(json({ok:true,section:s,metrics:{users,deposits,orders,ledger},recentDeposits,recentOrders}));
}