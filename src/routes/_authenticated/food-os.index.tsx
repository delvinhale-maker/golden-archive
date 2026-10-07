import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck, Boxes, Factory, Truck, AlertTriangle, Siren, FileCheck2, Activity } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/food-os/")({ component: FoodAssuranceOS });

type Org = { id: string; name: string; slug: string };
type Counts = { facilities:number; partners:number; items:number; lots:number; events:number; exceptions:number; recalls:number; challenges:number };
const empty: Counts={facilities:0,partners:0,items:0,lots:0,events:0,exceptions:0,recalls:0,challenges:0};

function FoodAssuranceOS(){
 const { user }=useAuth();
 const [orgs,setOrgs]=useState<Org[]>([]);
 const [orgId,setOrgId]=useState("");
 const [counts,setCounts]=useState<Counts>(empty);
 const [loading,setLoading]=useState(true);
 const [name,setName]=useState("");

 async function loadOrganizations(){
   if(!user) return;
   const {data,error}=await supabase.from("assurance_organizations").select("id,name,slug").order("created_at");
   if(error){toast.error(error.message);setLoading(false);return;}
   const list=(data??[]) as Org[]; setOrgs(list); setOrgId((current)=>current||list[0]?.id||""); setLoading(false);
 }
 useEffect(()=>{void loadOrganizations()},[user]);

 useEffect(()=>{ if(!orgId){setCounts(empty);return;} void (async()=>{
   const queries=[
    supabase.from("food_facilities").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
    supabase.from("food_trading_partners").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
    supabase.from("food_items").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
    supabase.from("food_traceability_lots").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
    supabase.from("food_traceability_events").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
    supabase.from("food_traceability_exceptions").select("id",{count:"exact",head:true}).eq("organization_id",orgId).neq("status","closed"),
    supabase.from("food_recall_cases").select("id",{count:"exact",head:true}).eq("organization_id",orgId).neq("status","closed"),
    supabase.from("food_mock_record_requests").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
   ];
   const r=await Promise.all(queries);
   setCounts({facilities:r[0].count??0,partners:r[1].count??0,items:r[2].count??0,lots:r[3].count??0,events:r[4].count??0,exceptions:r[5].count??0,recalls:r[6].count??0,challenges:r[7].count??0});
 })()},[orgId]);

 async function createOrganization(){
   if(!user||name.trim().length<2) return;
   const slug=(name.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")+"-"+crypto.randomUUID().slice(0,6));
   const {data,error}=await supabase.from("assurance_organizations").insert({name:name.trim(),slug,created_by:user.id}).select("id,name,slug").single();
   if(error){toast.error(error.message);return;}
   const {error:membershipError}=await supabase.from("assurance_memberships").insert({organization_id:data.id,user_id:user.id,role:"owner"});
   if(membershipError){toast.error(membershipError.message);return;}
   setName(""); toast.success("Food Assurance workspace created"); await loadOrganizations(); setOrgId(data.id);
 }

 const readiness=useMemo(()=>counts.lots===0?0:Math.max(0,Math.min(100,Math.round(100-(counts.exceptions*12)-(counts.recalls*18)))),[counts]);
 const cards=[
  ["Facilities",counts.facilities,Factory],["Trading Partners",counts.partners,Truck],["Food Items",counts.items,Boxes],["Traceability Lots",counts.lots,Boxes],
  ["Critical Tracking Events",counts.events,Activity],["Open Exceptions",counts.exceptions,AlertTriangle],["Active Recalls",counts.recalls,Siren],["24-Hour Challenges",counts.challenges,FileCheck2],
 ] as const;

 if(loading) return <main className="mx-auto max-w-7xl p-6 text-navy">Loading Food Assurance OS…</main>;
 if(!orgs.length) return <main className="mx-auto max-w-2xl p-6"><div className="rounded-2xl border border-ink/10 bg-white p-7 shadow-sm"><ShieldCheck className="mb-4 h-10 w-10 text-gold"/><h1 className="text-2xl font-bold text-navy">Food Traceability & Recall Assurance OS™</h1><p className="mt-2 text-sm text-mute">Create your secure organization workspace to begin traceability, recall readiness and evidence operations.</p><div className="mt-6 flex gap-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Organization name" className="min-h-11 flex-1 rounded-lg border border-ink/15 px-3"/><button onClick={createOrganization} className="rounded-lg bg-navy px-5 font-semibold text-gold">Create workspace</button></div></div></main>;

 return <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-7">
  <header className="flex flex-col gap-4 rounded-2xl bg-navy p-6 text-white md:flex-row md:items-center md:justify-between">
   <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-gold">AurumVault Assurance Cloud™</p><h1 className="mt-1 text-2xl font-bold">Food Traceability & Recall Assurance OS™</h1><p className="mt-2 max-w-2xl text-sm text-white/70">Evidence-backed traceability, exception management, recall command and readiness operations.</p></div>
   <select value={orgId} onChange={e=>setOrgId(e.target.value)} className="min-h-11 rounded-lg border border-white/20 bg-white px-3 text-navy">{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>
  </header>
  <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-ink/10 bg-white p-5 md:col-span-2"><p className="text-xs font-semibold uppercase tracking-wider text-mute">Operational command</p><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label,value,Icon])=><div key={label} className="rounded-xl bg-paper p-4"><Icon className="h-5 w-5 text-gold"/><p className="mt-3 text-2xl font-bold text-navy">{value}</p><p className="text-xs text-mute">{label}</p></div>)}</div></div><div className="rounded-2xl border border-ink/10 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-mute">Assurance readiness</p><p className="mt-4 text-5xl font-bold text-navy">{readiness}%</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-gold" style={{width:`${readiness}%`}}/></div><p className="mt-4 text-xs leading-relaxed text-mute">Readiness is evidence-based and reflects recorded exceptions and active recalls. It is not FDA certification.</p></div></section>
  <section className="rounded-2xl border border-ink/10 bg-white p-5"><h2 className="font-bold text-navy">Operating workspaces</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{["Products & FTL Applicability","Suppliers & Facilities","Traceability Lots","Critical Tracking Events","Lot Genealogy","Shipments","Traceability Exceptions","Recall Command Center","Corrective Actions","Evidence Vault","24-Hour Challenge","Reports & Sortable Export","Immutable Activity","Users & Roles"].map(x=><div key={x} className="rounded-xl border border-ink/10 p-4 text-sm font-medium text-navy">{x}</div>)}</div></section>
 </main>
}