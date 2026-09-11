import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Film, Upload, WandSparkles } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { supabase } from "@/integrations/supabase/client";
import {
  createCreatorStudioAssetUpload,
  updateCreatorStudioProject,
} from "@/lib/creator-studio.functions";
import { getCreatorStudioProjectWorkspace } from "@/lib/creator-studio-project.functions";
import {
  refreshCreatorStudioRenderStatus,
  startCreatorStudioRender,
} from "@/lib/creator-studio-render.functions";
import {
  startCreatorStudioExtraRenderCheckout,
  startCreatorStudioPlanCheckout,
} from "@/lib/creator-studio-billing.functions";

export const Route = createFileRoute("/_authenticated/creator-studio/$projectId")({ component: CreatorStudioProject });

const STYLES = ["LUXURY_EDITORIAL", "BOLD_SOCIAL", "CINEMATIC", "CLEAN_MINIMAL", "CREATOR_ENERGY", "BOOK_TRAILER"] as const;

function CreatorStudioProject() {
  const { projectId } = Route.useParams();
  const workspaceFn = useServerFn(getCreatorStudioProjectWorkspace);
  const updateFn = useServerFn(updateCreatorStudioProject);
  const uploadFn = useServerFn(createCreatorStudioAssetUpload);
  const renderFn = useServerFn(startCreatorStudioRender);
  const refreshFn = useServerFn(refreshCreatorStudioRenderStatus);
  const extraFn = useServerFn(startCreatorStudioExtraRenderCheckout);
  const planFn = useServerFn(startCreatorStudioPlanCheckout);
  const [busy, setBusy] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["creator-studio", "project", projectId],
    queryFn: () => workspaceFn({ data: { projectId } }),
    retry: false,
  });

  async function save(patch: Record<string, unknown>) {
    try {
      setBusy(true);
      await updateFn({ data: { id: projectId, ...patch } as never });
      await refetch();
      toast.success("Project saved");
    } catch { toast.error("Couldn't save project"); }
    finally { setBusy(false); }
  }

  async function upload(file: File, kind: "COVER" | "SCREENSHOT" | "LOGO") {
    try {
      setBusy(true);
      const prepared = await uploadFn({ data: { projectId, kind, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", byteSize: file.size } });
      const { error } = await supabase.storage.from("creator-studio-assets").uploadToSignedUrl(prepared.storagePath, prepared.uploadToken, file, { contentType: file.type });
      if (error) throw error;
      await refetch();
      toast.success("Asset uploaded");
    } catch { toast.error("Couldn't upload this image"); }
    finally { setBusy(false); }
  }

  async function render() {
    try {
      setBusy(true);
      const result = await renderFn({ data: { projectId, idempotencyKey: `${projectId}:${crypto.randomUUID()}` } });
      await refetch();
      toast.success(`Video queued (${result.jobId.slice(0, 8)})`);
    } catch { toast.error("Video couldn't be queued. Check your allowance and assets."); }
    finally { setBusy(false); }
  }

  async function refresh(jobId: string) {
    try {
      setBusy(true);
      const result = await refreshFn({ data: { jobId } });
      await refetch();
      toast.success(`Render status: ${result.status}`);
    } catch { toast.error("Couldn't refresh render status"); }
    finally { setBusy(false); }
  }

  async function checkout(kind: "EXTRA" | "PRO" | "BUSINESS") {
    try {
      setBusy(true);
      const result = kind === "EXTRA"
        ? await extraFn({ data: { quantity: 1 } })
        : await planFn({ data: { plan: kind === "PRO" ? "CREATOR_PRO" : "CREATOR_BUSINESS" } });
      window.location.assign(result.url);
    } catch { toast.error("Couldn't start checkout"); setBusy(false); }
  }

  if (isLoading || !data) return <PublisherShell accent={ACCENTS.help}><p className="p-6 text-sm text-mute">Loading Creator Studio…</p></PublisherShell>;
  const p = data.project as any;

  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="mx-auto max-w-5xl pb-16">
        <Link to="/creator-studio" className="inline-flex items-center gap-2 text-sm font-semibold text-navy"><ArrowLeft size={16}/> Creator Studio</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-mute">AurumVault Creator Studio™</p><h1 className="mt-2 font-display text-4xl text-navy">{p.title}</h1><p className="mt-1 text-sm text-mute">{p.goal.replaceAll("_", " ")} · {p.duration_seconds}s · 9:16</p></div>
          <button disabled={busy} onClick={render} className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><WandSparkles size={17}/> Generate My Video</button>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-2xl text-navy">1. Product & message</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Product title" value={p.product_title ?? ""} onBlur={(value) => save({ productTitle: value || null, wizardStep: 2 })}/>
                <Field label="Call to action" value={p.call_to_action ?? ""} onBlur={(value) => save({ callToAction: value || null, wizardStep: 2 })}/>
                <Field label="Destination URL" value={p.destination_url ?? ""} onBlur={(value) => save({ destinationUrl: value || null })}/>
                <Field label="Price label" value={p.price_label ?? ""} onBlur={(value) => save({ priceLabel: value || null })}/>
              </div>
            </section>

            <section className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-2xl text-navy">2. Add product assets</h2>
              <p className="mt-1 text-sm text-mute">Upload JPG, PNG or WebP. Cover + screenshots + optional logo.</p>
              <div className="mt-4 flex flex-wrap gap-2">{(["COVER","SCREENSHOT","LOGO"] as const).map((kind)=><label key={kind} className="cursor-pointer rounded-xl border border-ink/10 px-4 py-3 text-sm font-semibold text-navy"><Upload size={15} className="mr-2 inline"/>{kind.replace("_"," ")}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f) upload(f,kind);}}/></label>)}</div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(data.assets as any[]).map((a)=><div key={a.id} className="rounded-lg bg-ivory p-3 text-xs"><p className="font-bold text-navy">{a.kind}</p><p className="mt-1 truncate text-mute">{a.mime_type}</p></div>)}</div>
            </section>

            <section className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-2xl text-navy">3. Style & duration</h2>
              <div className="mt-4 flex flex-wrap gap-2">{STYLES.map((style)=><button key={style} onClick={()=>save({style,wizardStep:4})} className={`rounded-full border px-3 py-2 text-xs font-bold ${p.style_key===style?"border-navy bg-navy text-white":"border-ink/10 text-navy"}`}>{style.replaceAll("_"," ")}</button>)}</div>
              <div className="mt-3 flex gap-2">{([15,30,45] as const).map((d)=><button key={d} onClick={()=>save({durationSeconds:d})} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${p.duration_seconds===d?"border-gold bg-gold/10 text-navy":"border-ink/10 text-mute"}`}>{d}s</button>)}</div>
            </section>

            <section className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-2xl text-navy">4. Render history</h2>
              {!(data.jobs as any[]).length?<p className="mt-3 text-sm text-mute">No renders yet.</p>:<div className="mt-3 space-y-2">{(data.jobs as any[]).map((job)=><div key={job.id} className="flex items-center justify-between gap-3 rounded-xl bg-ivory p-3"><div><p className="text-sm font-bold text-navy">{job.status}</p><p className="text-xs text-mute">{job.duration_seconds}s · est. ${Number(job.estimated_cost_usd||0).toFixed(2)}</p></div><div className="flex gap-2">{job.output_url&&<a href={job.output_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-navy">View video</a>} {!['COMPLETED','FAILED','CANCELLED'].includes(job.status)&&<button onClick={()=>refresh(job.id)} className="text-xs font-bold text-navy">Refresh</button>}</div></div>)}</div>}
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gold/30 bg-navy p-5 text-white"><Film size={22}/><h2 className="mt-3 font-display text-2xl">No timeline required.</h2><p className="mt-2 text-sm text-white/70">AurumVault plans the scenes, prepares secure assets and renders the finished vertical promo.</p></div>
            <div className="rounded-2xl border border-ink/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-mute">Your plan</p><p className="mt-2 font-display text-2xl text-navy">{(data.entitlement as any).plan_key.replaceAll("_"," ")}</p><p className="mt-1 text-sm text-mute">{(data.entitlement as any).included_videos} included videos · {(data.entitlement as any).extra_video_credits} extra credits</p><div className="mt-4 grid gap-2"><button disabled={busy} onClick={()=>checkout("EXTRA")} className="rounded-lg border border-navy px-3 py-2 text-xs font-bold text-navy">Buy extra video · $3</button><button disabled={busy} onClick={()=>checkout("PRO")} className="rounded-lg bg-navy px-3 py-2 text-xs font-bold text-white">Creator Pro · 10/month</button><button disabled={busy} onClick={()=>checkout("BUSINESS")} className="rounded-lg bg-gold px-3 py-2 text-xs font-bold text-navy">Creator Business · 50/month</button></div></div>
          </aside>
        </div>
      </div>
    </PublisherShell>
  );
}

function Field({ label, value, onBlur }: { label: string; value: string; onBlur: (value: string) => void }) {
  const [local, setLocal] = useState(value);
  return <label className="text-xs font-bold text-navy">{label}<input value={local} onChange={(e)=>setLocal(e.target.value)} onBlur={()=>onBlur(local.trim())} className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 text-sm font-normal outline-none focus:border-navy"/></label>;
}
