import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getCreatorStudioProject, updateCreatorStudioProject } from "@/lib/creator-studio.functions";
import { CREATOR_STUDIO_GOAL_LABELS, CREATOR_STUDIO_STYLES } from "@/lib/creator-studio.schema";

export const Route = createFileRoute("/_authenticated/dashboard/creator-studio/$projectId")({ component: CreatorStudioWizard });

const STEPS = ["Goal", "Product assets", "Message", "Style", "Review"];
const STYLE_LABELS: Record<string, string> = {
  LUXURY_EDITORIAL: "Luxury Editorial",
  BOLD_SOCIAL: "Bold Social",
  CINEMATIC: "Cinematic",
  CLEAN_MINIMAL: "Clean Minimal",
  CREATOR_ENERGY: "Creator Energy",
  BOOK_TRAILER: "Book Trailer",
};

function CreatorStudioWizard() {
  const { projectId } = Route.useParams();
  const getFn = useServerFn(getCreatorStudioProject);
  const updateFn = useServerFn(updateCreatorStudioProject);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["creator-studio", projectId], queryFn: () => getFn({ data: { id: projectId } }), retry: false });
  const [saving, setSaving] = useState(false);

  async function patch(input: Record<string, unknown>) {
    setSaving(true);
    try {
      await updateFn({ data: { id: projectId, ...input } as any });
      await qc.invalidateQueries({ queryKey: ["creator-studio", projectId] });
      toast.success("Project saved");
    } catch (error: any) {
      toast.error(error?.message ?? "Couldn't save project");
    } finally { setSaving(false); }
  }

  if (isLoading) return <PublisherShell accent={ACCENTS.help}><p className="text-sm text-mute">Loading Creator Studio…</p></PublisherShell>;
  if (error || !data) return <PublisherShell accent={ACCENTS.help}><p className="text-sm text-red-700">Creator Studio project unavailable.</p></PublisherShell>;

  const { project, assets } = data;
  const step = project.wizard_step;
  const next = () => patch({ wizardStep: Math.min(5, step + 1) });
  const back = () => patch({ wizardStep: Math.max(1, step - 1) });

  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="max-w-4xl">
        <Link to="/dashboard/creator-studio" className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"><ArrowLeft size={14} /> Creator Studio</Link>
        <div className="mt-4"><h1 className="font-display text-3xl text-navy">{project.product_title || project.title}</h1><p className="mt-1 text-sm text-mute">{CREATOR_STUDIO_GOAL_LABELS[project.goal]} · 9:16 vertical video</p></div>

        <div className="mt-7 grid grid-cols-5 gap-2" aria-label="Creator Studio progress">
          {STEPS.map((label, index) => { const n = index + 1; const done = n < step; const active = n === step; return <button key={label} onClick={() => patch({ wizardStep: n })} className={`rounded-xl border px-2 py-3 text-center text-xs ${active ? "border-gold bg-gold/10 text-navy" : "border-ink/10 bg-white text-mute"}`}><span className="mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] text-white">{done ? <Check size={11}/> : n}</span>{label}</button>; })}
        </div>

        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-6">
          {step === 1 && <div><h2 className="font-display text-2xl text-navy">Your video goal</h2><p className="mt-2 text-sm text-mute">This project is set to <strong>{CREATOR_STUDIO_GOAL_LABELS[project.goal]}</strong>. Goal changes can be added later without exposing an editor timeline.</p></div>}

          {step === 2 && <div><h2 className="font-display text-2xl text-navy">Product assets</h2><p className="mt-2 text-sm text-mute">Add a product cover, screenshots and an optional logo. Assets are stored in a private owner-scoped bucket.</p><div className="mt-5 rounded-xl border border-dashed border-ink/20 p-6 text-center"><ImagePlus className="mx-auto text-gold"/><p className="mt-2 text-sm font-semibold text-navy">Asset upload surface reserved</p><p className="mt-1 text-xs text-mute">CS1 establishes the private asset model. Secure upload orchestration is connected before provider rendering in CS3.</p><p className="mt-3 text-xs text-mute">{assets.length} assets registered</p></div></div>}

          {step === 3 && <MessageForm project={project} onSave={patch} saving={saving} />}

          {step === 4 && <div><h2 className="font-display text-2xl text-navy">Style & duration</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{CREATOR_STUDIO_STYLES.map((style) => <button key={style} onClick={() => patch({ styleKey: style })} className={`rounded-xl border p-4 text-left text-sm ${project.style_key === style ? "border-gold bg-gold/10 font-semibold text-navy" : "border-ink/10 text-mute"}`}>{STYLE_LABELS[style]}</button>)}</div><div className="mt-5 flex gap-2">{[15,30,45].map((duration) => <button key={duration} onClick={() => patch({ durationSeconds: duration })} className={`rounded-full border px-4 py-2 text-sm ${project.duration_seconds === duration ? "border-gold bg-gold/10 font-bold text-navy" : "border-ink/10 text-mute"}`}>{duration} sec</button>)}</div></div>}

          {step === 5 && <div><h2 className="font-display text-2xl text-navy">Ready for the template engine</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm"><Summary label="Goal" value={CREATOR_STUDIO_GOAL_LABELS[project.goal]} /><Summary label="Product" value={project.product_title || "Not added"} /><Summary label="CTA" value={project.call_to_action || "Not added"} /><Summary label="Style" value={STYLE_LABELS[project.style_key] || project.style_key} /><Summary label="Duration" value={`${project.duration_seconds} seconds`} /><Summary label="Assets" value={`${assets.length} registered`} /></div><div className="mt-6 rounded-xl bg-navy p-4 text-sm text-white"><strong className="text-gold">CS1 complete:</strong> This wizard intentionally stops before rendering. CS2 will convert this creative brief into a validated scene plan.</div></div>}
        </div>

        <div className="mt-5 flex justify-between"><button disabled={step === 1 || saving} onClick={back} className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold text-navy disabled:opacity-40">Back</button>{step < 5 ? <button disabled={saving} onClick={next} className="inline-flex items-center gap-1 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy">Continue <ArrowRight size={14}/></button> : <span className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-700">Foundation ready</span>}</div>
      </div>
    </PublisherShell>
  );
}

function MessageForm({ project, onSave, saving }: { project: any; onSave: (input: Record<string, unknown>) => Promise<void>; saving: boolean }) {
  const [productTitle, setProductTitle] = useState(project.product_title ?? "");
  const [cta, setCta] = useState(project.call_to_action ?? "");
  const [url, setUrl] = useState(project.destination_url ?? "");
  const [price, setPrice] = useState(project.price_label ?? "");
  return <div><h2 className="font-display text-2xl text-navy">Product message</h2><p className="mt-2 text-sm text-mute">Give AurumVault the core information it will place into the promotion.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Product title" value={productTitle} setValue={setProductTitle}/><Field label="Call to action" value={cta} setValue={setCta} placeholder="Download today"/><Field label="Destination URL" value={url} setValue={setUrl} placeholder="https://…"/><Field label="Price (optional)" value={price} setValue={setPrice} placeholder="$19.99"/></div><button disabled={saving} onClick={() => onSave({ productTitle, callToAction: cta, destinationUrl: url, priceLabel: price })} className="mt-5 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white"><Save size={14}/> Save message</button></div>;
}
function Field({ label, value, setValue, placeholder }: { label: string; value: string; setValue: (value: string) => void; placeholder?: string }) { return <label className="text-sm font-semibold text-navy">{label}<input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-ink/10 px-3 py-2.5 font-normal outline-none focus:border-gold"/></label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-ink/10 p-4"><p className="text-xs text-mute">{label}</p><p className="mt-1 font-semibold text-navy">{value}</p></div>; }
