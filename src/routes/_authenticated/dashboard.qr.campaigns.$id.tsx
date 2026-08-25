import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowLeft, Trophy } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getMyQrCampaign, getQrCampaignAnalytics } from "@/lib/qr-campaigns.functions";

export const Route = createFileRoute("/_authenticated/dashboard/qr/campaigns/$id")({
  component: QrCampaignDetailPage,
});

function QrCampaignDetailPage() {
  const { id } = Route.useParams();
  const getCampaignFn = useServerFn(getMyQrCampaign);
  const getAnalyticsFn = useServerFn(getQrCampaignAnalytics);

  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ["qr", "campaign", id],
    queryFn: () => getCampaignFn({ data: { id } }),
  });
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["qr", "campaign-analytics", id],
    queryFn: () => getAnalyticsFn({ data: { id } }),
  });

  const chartData = (analytics?.placements ?? []).map((p) => ({
    name: p.placementLabel || p.name,
    scans: p.scans,
  }));

  if (loadingCampaign) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="text-mute">Loading…</p>
      </PublisherShell>
    );
  }

  if (!campaign) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="text-navy font-semibold">Campaign not found.</p>
        <Link to="/dashboard/qr/campaigns" className="text-sm text-mute hover:text-navy">
          Back to Campaigns
        </Link>
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/qr/campaigns"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>
      <h1 className="font-display text-3xl text-navy mt-3">{campaign.name}</h1>

      {loadingAnalytics ? (
        <p className="mt-8 text-mute">Loading analytics…</p>
      ) : analytics ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-ink/10 bg-white p-4">
              <p className="text-xs text-mute">Total Scans</p>
              <p className="font-display text-2xl text-navy mt-1">{analytics.totalScans}</p>
            </div>
            <div className="rounded-xl border border-ink/10 bg-white p-4">
              <p className="text-xs text-mute">Last 7 Days</p>
              <p className="font-display text-2xl text-navy mt-1">{analytics.scansLast7Days}</p>
            </div>
            <div className="rounded-xl border border-ink/10 bg-white p-4">
              <p className="text-xs text-mute">Last 30 Days</p>
              <p className="font-display text-2xl text-navy mt-1">{analytics.scansLast30Days}</p>
            </div>
          </div>

          {analytics.topQr && analytics.topQr.scans > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-navy">
              <Trophy size={15} className="text-gold" />
              Best performer:{" "}
              <strong>{analytics.topQr.placementLabel || analytics.topQr.name}</strong> (
              {analytics.topQr.scans} scans)
            </div>
          )}

          {chartData.length === 0 ? (
            <p className="mt-8 text-sm text-mute">
              No QR codes in this campaign yet. Attach one when creating or editing a QR code.
            </p>
          ) : (
            <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-lg text-navy mb-4">Scans by Placement</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="scans" fill="#B8860B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {analytics.placements.length > 0 && (
            <ul className="mt-6 space-y-2">
              {analytics.placements.map((p) => (
                <li
                  key={p.qrProjectId}
                  className="flex items-center justify-between rounded-lg border border-ink/10 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-navy">{p.placementLabel || p.name}</p>
                    <p className="text-xs text-mute">{p.name}</p>
                  </div>
                  <p className="text-sm text-mute">
                    {p.scans} scan{p.scans === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </PublisherShell>
  );
}
