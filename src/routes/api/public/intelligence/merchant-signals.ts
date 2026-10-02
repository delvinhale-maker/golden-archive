import { createFileRoute } from "@tanstack/react-router";
import { toMerchantSignal } from "@/lib/aurum-intelligence/gaps";
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
export const Route=createFileRoute("/api/public/intelligence/merchant-signals")({
 server:{handlers:{GET:async({request})=>{
  const expected=process.env.AURUMVAULT_MERCHANT_INTELLIGENCE_KEY;
  const supplied=request.headers.get("x-api-key")??(request.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
  if(!expected||!supplied||!safeEqual(supplied,expected)) return Response.json({error:"Unauthorized"},{status:401});
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data,error}=await (supabaseAdmin.from("aurum_marketplace_gap_signals") as any).select("*").order("request_count",{ascending:false}).limit(50);
  if(error) return Response.json({error:"Signal query failed"},{status:500});
  const signals=(data??[]).map((r:any)=>toMerchantSignal({
   objectiveKey:r.objective_key,categoryHint:r.category_hint,requestCount:Number(r.request_count),
   resultCount:0,noResultCount:Number(r.no_result_count),lowConfidenceCount:Number(r.low_confidence_count),
   conversionCount:Number(r.conversion_count),firstSeenAt:r.first_seen_at,lastSeenAt:r.last_seen_at
  })).sort((a:any,b:any)=>b.demandScore-a.demandScore);
  return Response.json({schema:"aurum.merchant-intelligence.v1",store:"aurumvault",generatedAt:new Date().toISOString(),signals});
 }}}});
