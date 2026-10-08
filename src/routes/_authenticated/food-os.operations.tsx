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
 lots:{table:"food_traceability_lots",fields:["item_id","lot_code","facility_id","quantity","unit"]},
 events:{table:"food_traceability_events",fields:["lot_id","facility_id","event_type","event_time","reference_document"]},
 kdes:{table:"food_event_kdes",fields:["event_id","kde_key","kde_value"]},
 genealogy:{table:"food_lot_relationships",fields:["parent_lot_id","child_lot_id","relationship_type"]},
 shipments:{table:"food_shipments",fields:["shipment_code","origin_facility_id","destination_name","shipped_at"]},
 shipmentItems:{table:"food_shipment_items",fields:["shipment_id","lot_id","quantity","unit"]},
 correctiveActions:{table:"food_corrective_actions",fields:["exception_id","action","owner_id","due_at"]},
 evidence:{table:"food_evidence",fields:["corrective_action_id","evidence_type","external_reference","sha256"]},
 reviews:{table:"food_assurance_reviews",fields:["entity_type","entity_id","review_type","status","notes"]},
 challenges:{table:"food_mock_record_requests",fields:["lot_id","deadline_at"]},
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
 const [lookups,setLookups]=useState<Record<string,{id:string;label:string}[]>>({});
 const referenceTables:Record<string,{table:string;label:string}>={item_id:{table:"food_items",label:"name"},facility_id:{table:"food_facilities",label:"name"},lot_id:{table:"food_traceability_lots",label:"lot_code"},event_id:{table:"food_traceability_events",label:"event_type"},parent_lot_id:{table:"food_traceability_lots",label:"lot_code"},child_lot_id:{table:"food_traceability_lots",label:"lot_code"},origin_facility_id:{table:"food_facilities",label:"name"},shipment_id:{table:"food_shipments",label:"shipment_code"},exception_id:{table:"food_traceability_exceptions",label:"title"},corrective_action_id:{table:"food_corrective_actions",label:"action"}};
 useEffect(()=>{if(!user)return;void supabase.from("assurance_organizations").select("id,name").order("name").then(({data,error})=>{if(error)toast.error(error.message);else{setOrganizations(data??[]);setOrganizationId(current=>current||data?.[0]?.id||"");}})},[user]);
 useEffect(()=>{if(!organizationId)return;let live=true;void Promise.all(Object.entries(referenceTables).map(async ([field,config])=>{const {data}=await supabase.from(config.table as "food_items").select(`id,${config.label}`).eq("organization_id",organizationId).limit(200);return [field,(data??[]).map((row:Record<string,unknown>)=>({id:String(row.id),label:String(row[config.label]??row.id)}))] as const;})).then(entries=>{if(live)setLookups(Object.fromEntries(entries));});return()=>{live=false}},[organizationId]);
 useEffect(()=>{setForm({});if(!organizationId)return;let active=true;void (async()=>{const {data,error}=await supabase.from(definitions[section].table).select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(100);if(active){if(error)toast.error(error.message);else setRecords((data??[]) as RecordRow[]);}})();return()=>{active=false}},[organizationId,section]);
 async function save(){
  if(!user||!organizationId||saving)return;
  const definition=definitions[section];
  const requiredBySection:Partial<Record<Section,string[]>>={lots:["item_id","lot_code","quantity","unit"],events:["lot_id","event_type","event_time"],kdes:["event_id","kde_key","kde_value"],genealogy:["parent_lot_id","child_lot_id","relationship_type"],shipments:["shipment_code","destination_name"],shipmentItems:["shipment_id","lot_id","quantity","unit"],correctiveActions:["action","owner_id"],evidence:["corrective_action_id","evidence_type"],reviews:["entity_type","entity_id","review_type","status"],challenges:["lot_id","deadline_at"],exceptions:["title","severity"],recalls:["title","reason"]};
  const required=requiredBySection[section]??[definition.fields[0]];
  const missing=required.filter(field=>!form[field]?.trim());
  if(missing.length){toast.error(`Complete required fields: ${missing.join(", ")}`);return;}
  setSaving(true);
  const payload:Record<string,unknown>={organization_id:organizationId};
  for(const field of definition.fields)if(form[field]?.trim())payload[field]=form[field].trim();
  if(section==="recalls" || section==="events" || section==="challenges")payload.created_by=user.id;
  if(section==="evidence")payload.uploaded_by=user.id;
  if(section==="reviews")payload.reviewer_id=user.id;
  if(section==="lots" || section==="shipmentItems"){if(!Number.isFinite(Number(form.quantity))||Number(form.quantity)<=0){toast.error("Quantity must be greater than zero");setSaving(false);return;}payload.quantity=Number(form.quantity);}
  if(section==="genealogy" && form.parent_lot_id===form.child_lot_id){toast.error("Parent and child lots must differ");setSaving(false);return;}
  if(section==="items")payload.ftl_applicable=false;
  for(const field of ["event_time","shipped_at","due_at","deadline_at"]){if(typeof payload[field]==="string"){const date=new Date(payload[field] as string);if(Number.isNaN(date.getTime())){toast.error(`Invalid ${field}`);setSaving(false);return;}payload[field]=date.toISOString();}}
  if(section==="reviews" && !["pending","approved","rejected","needs_changes"].includes(String(payload.status))){toast.error("Review status must be pending, approved, rejected, or needs_changes");setSaving(false);return;}
  const {error}=await supabase.from(definition.table).insert(payload as never);
  if(error)toast.error(error.message);
  else{toast.success("Record created");setForm({});const result=await supabase.from(definition.table).select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(100);setRecords((result.data??[]) as RecordRow[]);}
  setSaving(false);
 }
 return <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-8"><header className="rounded-2xl bg-navy p-6 text-white"><p className="text-xs uppercase tracking-widest text-gold">AurumVault Assurance Cloud</p><h1 className="mt-2 text-2xl font-bold">Food OS · Operations</h1><p className="mt-2 text-white/70">Organization-scoped records and traceability operations.</p></header><div className="flex flex-wrap gap-3"><select aria-label="Organization" className="rounded-lg border p-3" value={organizationId} onChange={e=>setOrganizationId(e.target.value)}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><select aria-label="Workspace" className="rounded-lg border p-3" value={section} onChange={e=>setSection(e.target.value as Section)}>{Object.keys(definitions).map(k=><option key={k} value={k}>{k[0].toUpperCase()+k.slice(1)}</option>)}</select></div><section className="rounded-2xl border bg-white p-6"><h2 className="text-lg font-semibold">New {section} record</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{definitions[section].fields.map(field=><label className="text-sm font-medium" key={field}>{field.replaceAll("_"," ")}{referenceTables[field]?<select className="mt-1 block w-full rounded-lg border p-3" value={form[field]??""} onChange={e=>setForm(v=>({...v,[field]:e.target.value}))}><option value="">Select {field.replaceAll("_"," ")}</option>{(lookups[field]??[]).map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select>:<input className="mt-1 block w-full rounded-lg border p-3" type={field==="quantity"?"number":field==="event_time"||field==="shipped_at"||field==="due_at"||field==="deadline_at"?"datetime-local":"text"} value={form[field]??""} onChange={e=>setForm(v=>({...v,[field]:e.target.value}))}/>}</label>)}</div><button disabled={saving||!organizationId} onClick={()=>void save()} className="mt-4 rounded-lg bg-navy px-5 py-3 font-semibold text-white disabled:opacity-50">{saving?"Saving…":"Create record"}</button></section><section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Recent {section}</h2><div className="mt-4 space-y-3">{records.length===0?<p className="text-sm text-gray-500">No records yet.</p>:records.map(row=><article key={row.id} className="rounded-xl border p-4"><p className="font-medium">{String(row.name??row.title??row.sku??row.id)}</p><p className="mt-1 text-xs text-gray-500">{row.created_at??""}</p></article>)}</div></section></main>;
}
