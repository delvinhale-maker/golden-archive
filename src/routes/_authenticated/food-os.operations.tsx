import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route=createFileRoute("/_authenticated/food-os/operations")({component:Operations});
const definitions={
 facilities:{table:"food_facilities",fields:["name","facility_type"]},
 partners:{table:"food_trading_partners",fields:["name","partner_type"]},
 items:{table:"food_items",fields:["sku","name","description"]},
 exceptions:{table:"food_traceability_exceptions",fields:["title","details","severity"]},
 recalls:{table:"food_recall_cases",fields:["title","reason"]},
} as const;
type Section=keyof typeof definitions;
type RecordRow={id:string;created_at?:string;[key:string]:unknown};
function Operations(){
 const {user}=useAuth();
 const [organizations,setOrganizations]=useState<{id:string;name:string}[]>([]);
 const [organizationId,setOrganizationId]=useState("");
 const [section,setSection]=useState<Section>("facilities");
 const [form,setForm]=useState<Record<string,string>>({});
 const [records,setRecords]=useState<RecordRow[]>([]);
 const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!user)return;void supabase.from("assurance_organizations").select("id,name").order("name").then(({data,error})=>{if(error)toast.error(error.message);else{setOrganizations(data??[]);setOrganizationId(current=>current||data?.[0]?.id||"");}})},[user]);
 useEffect(()=>{setForm({});if(!organizationId)return;let active=true;void (async()=>{const {data,error}=await supabase.from(definitions[section].table).select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(100);if(active){if(error)toast.error(error.message);else setRecords((data??[]) as RecordRow[]);}})();return()=>{active=false}},[organizationId,section]);
 async function save(){
  if(!user||!organizationId||saving)return;
  const definition=definitions[section];
  if(!form[definition.fields[0]]?.trim()){toast.error("Complete the first required field");return;}
  setSaving(true);
  const payload:Record<string,unknown>={organization_id:organizationId};
  for(const field of definition.fields)if(form[field]?.trim())payload[field]=form[field].trim();
  if(section==="recalls")payload.created_by=user.id;
  const {error}=await supabase.from(definition.table).insert(payload as never);
  if(error)toast.error(error.message);
  else{toast.success("Record created");setForm({});const result=await supabase.from(definition.table).select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(100);setRecords((result.data??[]) as RecordRow[]);}
  setSaving(false);
 }
 return <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-8"><header className="rounded-2xl bg-navy p-6 text-white"><p className="text-xs uppercase tracking-widest text-gold">AurumVault Assurance Cloud</p><h1 className="mt-2 text-2xl font-bold">Food OS · Operations</h1><p className="mt-2 text-white/70">Organization-scoped records and traceability operations.</p></header><div className="flex flex-wrap gap-3"><select aria-label="Organization" className="rounded-lg border p-3" value={organizationId} onChange={e=>setOrganizationId(e.target.value)}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><select aria-label="Workspace" className="rounded-lg border p-3" value={section} onChange={e=>setSection(e.target.value as Section)}>{Object.keys(definitions).map(k=><option key={k} value={k}>{k[0].toUpperCase()+k.slice(1)}</option>)}</select></div><section className="rounded-2xl border bg-white p-6"><h2 className="text-lg font-semibold">New {section.slice(0,-1)} record</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{definitions[section].fields.map(field=><label className="text-sm font-medium" key={field}>{field.replaceAll("_"," ")}<input className="mt-1 block w-full rounded-lg border p-3" value={form[field]??""} onChange={e=>setForm(v=>({...v,[field]:e.target.value}))}/></label>)}</div><button disabled={saving||!organizationId} onClick={()=>void save()} className="mt-4 rounded-lg bg-navy px-5 py-3 font-semibold text-white disabled:opacity-50">{saving?"Saving…":"Create record"}</button></section><section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Recent {section}</h2><div className="mt-4 space-y-3">{records.length===0?<p className="text-sm text-gray-500">No records yet.</p>:records.map(row=><article key={row.id} className="rounded-xl border p-4"><p className="font-medium">{String(row.name??row.title??row.sku??row.id)}</p><p className="mt-1 text-xs text-gray-500">{row.created_at??""}</p></article>)}</div></section></main>;
}
