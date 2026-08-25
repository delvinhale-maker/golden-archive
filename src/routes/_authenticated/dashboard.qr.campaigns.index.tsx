import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Archive, Megaphone, Plus, ScanLine } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  createQrCampaign,
  listMyQrCampaigns,
  updateQrCampaign,
} from "@/lib/qr-business.functions";

export const Route = createFileRoute("/_authenticated/dashboard/qr/campaigns/")({
  component: CampaignsPage,
});

function CampaignsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMyQrCampaigns);
  const createFn = useServerFn(createQrCampaign);
  const updateFn = useServerFn(updateQrCampaign);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["qr", "campaigns"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  async function create() {
    if (!name.trim()) return toast.error("Give your campaign a name");
    setSaving(true);
    try {
      await createFn({ data: { name, goal: goal || undefined } });
      setName("");
      setGoal("");
      queryClient.invalidateQueries({ queryKey: ["qr", "campaigns"] });
      toast.success("Campaign created");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create campaign");
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this campaign? Its QR codes keep working.")) return;
    try {
      await updateFn({ data: { id, status: "archived" } });
      queryClient.invalidateQueries({ queryKey: ["qr", "campaigns"] });
      toast.success("Campaign archived");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't archive campaign");
    }
  }

  const campaigns = data ?? [];

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/qr"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to QR Codes
      </Link>
      <h1 className="font-display text-3xl text-navy mt-3">Campaigns</h1>
      <p className="text-sm text-mute mt-1">
        Group QR codes that belong to the same push — an open house, a launch, a season — and see
        which one earns the scans.
      </p>

      <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy">Start a campaign</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name (e.g. Spring Open House)"
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What's the goal? (optional)"
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={create}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
          >
            <Plus size={15} /> {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </section>

      {isLoading ? (
        <p className="mt-8 text-mute">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <Megaphone className="mx-auto text-mute" size={30} />
          <p className="font-display text-xl text-navy mt-3">No campaigns yet</p>
          <p className="text-sm text-mute mt-2 max-w-md mx-auto">
            Create one above, then choose it while making a QR code.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-ink/10 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-navy truncate">{c.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-ink/5 text-mute"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                {c.goal && <p className="text-xs text-mute mt-1 truncate">{c.goal}</p>}
                <p className="text-xs text-mute mt-0.5 inline-flex items-center gap-1">
                  <ScanLine size={12} /> {c.scans.total} scan{c.scans.total === 1 ? "" : "s"} ·{" "}
                  {c.scans.last7Days} in the last 7 days · {c.qrCount} QR code
                  {c.qrCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to="/dashboard/qr/campaigns/$id"
                  params={{ id: c.id }}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-paper"
                >
                  View placements
                </Link>
                {c.status === "active" && (
                  <button
                    type="button"
                    onClick={() => archive(c.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Archive size={13} /> Archive
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PublisherShell>
  );
}
