import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Layers, ScanLine } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { createQrCampaign, listMyQrCampaigns } from "@/lib/qr-campaigns.functions";
import { QR_NICHES } from "@/lib/qr-niches";

export const Route = createFileRoute("/_authenticated/dashboard/qr/campaigns")({
  component: QrCampaignsPage,
});

function QrCampaignsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMyQrCampaigns);
  const createFn = useServerFn(createQrCampaign);

  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["qr", "my-campaigns"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });
  const campaigns = data ?? [];

  async function handleCreate() {
    if (!name.trim()) return toast.error("Give your campaign a name");
    setCreating(true);
    try {
      await createFn({ data: { name, niche: (niche || undefined) as any } });
      setName("");
      setNiche("");
      queryClient.invalidateQueries({ queryKey: ["qr", "my-campaigns"] });
      toast.success("Campaign created");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create campaign");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/qr"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to QR Codes
      </Link>
      <h1 className="font-display text-3xl text-navy mt-3">QR Campaigns</h1>
      <p className="text-mute text-sm mt-1">
        Group multiple QR codes — different placements, same goal — to compare which one performs
        best.
      </p>

      <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy">New Campaign</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Spring Open House"
            className="flex-1 min-w-[220px] rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
          >
            <option value="">No niche</option>
            {Object.values(QR_NICHES).map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy disabled:opacity-50"
          >
            <Plus size={15} /> Create
          </button>
        </div>
      </section>

      {isLoading ? (
        <p className="mt-8 text-mute">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <Layers className="mx-auto text-mute" size={32} />
          <p className="font-display text-xl text-navy mt-3">No campaigns yet</p>
          <p className="text-sm text-mute mt-2 max-w-md mx-auto">
            Create one to group QR codes that share a goal — like different placements for the same
            open house or product launch.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                to="/dashboard/qr/campaigns/$id"
                params={{ id: c.id }}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-ink/10 bg-white p-4 hover:border-navy/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy truncate">{c.name}</p>
                  <p className="text-xs text-mute mt-1">
                    {c.qrCount} QR code{c.qrCount === 1 ? "" : "s"}
                    {c.niche ? ` · ${QR_NICHES[c.niche as keyof typeof QR_NICHES]?.label ?? c.niche}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-mute inline-flex items-center gap-1">
                  <ScanLine size={12} /> {c.totalScans} scan{c.totalScans === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PublisherShell>
  );
}
