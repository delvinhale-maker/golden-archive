import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, ScanLine } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getCampaignPlacements } from "@/lib/qr-business.functions";

export const Route = createFileRoute("/_authenticated/dashboard/qr/campaigns/$id")({
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const placementsFn = useServerFn(getCampaignPlacements);

  const { data, isLoading, error } = useQuery({
    queryKey: ["qr", "campaign", id],
    queryFn: () => placementsFn({ data: { campaignId: id } }),
  });

  const best = (data?.placements ?? [])
    .slice()
    .sort((a, b) => b.scans.total - a.scans.total)
    .find((p) => p.scans.total > 0);

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/qr/campaigns"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      {isLoading ? (
        <p className="mt-8 text-mute">Loading…</p>
      ) : error || !data ? (
        <p className="mt-8 text-mute">Campaign not found.</p>
      ) : (
        <>
          <h1 className="font-display text-3xl text-navy mt-3">{data.campaign.name}</h1>
          {data.campaign.goal && <p className="text-sm text-mute mt-1">{data.campaign.goal}</p>}

          {best && (
            <p className="mt-4 rounded-xl border border-ink/10 bg-white p-4 text-sm text-navy">
              Your best performer so far:{" "}
              <strong>{best.placementLabel ?? best.name}</strong> with {best.scans.total} scan
              {best.scans.total === 1 ? "" : "s"}.
            </p>
          )}

          <h2 className="font-display text-xl text-navy mt-6">Placements</h2>
          <p className="text-sm text-mute mt-1">
            Each placement is its own QR code, so its scans are counted separately.
          </p>

          {data.placements.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-8 text-center">
              <MapPin className="mx-auto text-mute" size={28} />
              <p className="font-display text-lg text-navy mt-3">No QR codes in this campaign yet</p>
              <Link
                to="/dashboard/qr/new"
                className="mt-4 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy"
              >
                Create a QR Code
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.placements.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-ink/10 bg-white p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy truncate">
                        {p.placementLabel ?? p.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                          p.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.status === "paused"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-ink/5 text-mute"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-mute mt-1 truncate">{p.name}</p>
                    <p className="text-xs text-mute mt-0.5 inline-flex items-center gap-1">
                      <ScanLine size={12} /> {p.scans.total} total · {p.scans.last7Days} in 7 days ·{" "}
                      {p.scans.last30Days} in 30 days
                    </p>
                  </div>
                  <Link
                    to="/dashboard/qr/$id"
                    params={{ id: p.id }}
                    className="shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-paper"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PublisherShell>
  );
}
