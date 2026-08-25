import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Pause, Play } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  getMyQrProject,
  getQrProjectAnalytics,
  updateQrProject,
  renderQrProjectImage,
  type QrRenderResult,
} from "@/lib/qr.functions";
import { listMyQrCampaigns } from "@/lib/qr-campaigns.functions";
import { DYNAMIC_QR_DESTINATION_TYPES, type QrDestinationType } from "@/lib/qr";

export const Route = createFileRoute("/_authenticated/dashboard/qr/$id")({
  component: EditQrPage,
});

function downloadResult(result: QrRenderResult, filename: string) {
  const blob =
    result.format === "svg"
      ? new Blob([result.data], { type: "image/svg+xml" })
      : (() => {
          const [, base64] = result.data.split(",");
          const bytes = atob(base64);
          const arr = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          return new Blob([arr], { type: "image/png" });
        })();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function EditQrPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getMyQrProject);
  const updateFn = useServerFn(updateQrProject);
  const renderFn = useServerFn(renderQrProjectImage);
  const analyticsFn = useServerFn(getQrProjectAnalytics);
  const listCampaignsFn = useServerFn(listMyQrCampaigns);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [destinationType, setDestinationType] = useState<QrDestinationType>("url");
  const [destination, setDestination] = useState("");
  const [status, setStatus] = useState("active");
  const [publicId, setPublicId] = useState("");
  const [scanCount, setScanCount] = useState(0);
  const [placementLabel, setPlacementLabel] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const { data: analytics } = useQuery({
    queryKey: ["qr", "project-analytics", id],
    queryFn: () => analyticsFn({ data: { id } }),
    enabled: !loading && !notFound,
  });
  const { data: campaigns } = useQuery({
    queryKey: ["qr", "my-campaigns"],
    queryFn: () => listCampaignsFn(),
    staleTime: 30_000,
    enabled: !loading && !notFound,
  });

  async function loadPreview() {
    try {
      const result = await renderFn({ data: { id, format: "png" } });
      setPreviewSrc(result.data);
    } catch {
      /* preview is best-effort */
    }
  }

  useEffect(() => {
    getFn({ data: { id } })
      .then((row: any) => {
        setName(row.name);
        setDestinationType(row.destination_type === "text" ? "url" : row.destination_type);
        setDestination(row.destination);
        setStatus(row.status);
        setPublicId(row.public_id);
        setScanCount(row.scanCount ?? 0);
        setPlacementLabel(row.placement_label ?? "");
        setCampaignId(row.campaign_id ?? "");
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!loading && !notFound) void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, notFound]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateFn({
        data: {
          id,
          name,
          destinationType,
          destination,
          placementLabel: placementLabel || undefined,
          campaignId: campaignId || null,
        },
      });
      toast.success("Destination updated — the same QR code keeps working");
      void loadPreview();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  }

  async function togglePause() {
    const next = status === "active" ? "paused" : "active";
    try {
      await updateFn({ data: { id, status: next as "active" | "paused" } });
      setStatus(next);
      toast.success(next === "paused" ? "QR code paused" : "QR code reactivated");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't update QR code");
    }
  }

  async function handleDownload(format: "png" | "svg") {
    try {
      const result = await renderFn({ data: { id, format } });
      downloadResult(result, `${name || "qr-code"}.${format}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't download QR code");
    }
  }

  if (loading) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="text-mute">Loading…</p>
      </PublisherShell>
    );
  }

  if (notFound) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <p className="text-navy font-semibold">QR code not found.</p>
        <Link to="/dashboard/qr" className="text-sm text-mute hover:text-navy">
          Back to QR Codes
        </Link>
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/qr"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to QR Codes
      </Link>
      <h1 className="font-display text-3xl text-navy mt-3">Edit QR Code</h1>
      <p className="text-sm text-mute mt-1">
        You can change where this QR leads without reprinting it. {scanCount} scan
        {scanCount === 1 ? "" : "s"} so far.
      </p>

      {analytics && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-ink/10 bg-white p-3">
            <p className="text-[11px] text-mute">Today</p>
            <p className="font-display text-xl text-navy">{analytics.scansToday}</p>
          </div>
          <div className="rounded-lg border border-ink/10 bg-white p-3">
            <p className="text-[11px] text-mute">Last 7 Days</p>
            <p className="font-display text-xl text-navy">{analytics.scansLast7Days}</p>
          </div>
          <div className="rounded-lg border border-ink/10 bg-white p-3">
            <p className="text-[11px] text-mute">Last 30 Days</p>
            <p className="font-display text-xl text-navy">{analytics.scansLast30Days}</p>
          </div>
          <div className="rounded-lg border border-ink/10 bg-white p-3">
            <p className="text-[11px] text-mute">Total</p>
            <p className="font-display text-xl text-navy">{analytics.totalScans}</p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-ink/10 bg-white p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-navy">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-navy">Destination type</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {DYNAMIC_QR_DESTINATION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDestinationType(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    destinationType === t
                      ? "border-navy bg-navy text-white"
                      : "border-ink/15 text-navy"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-navy">Destination</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-navy">Placement (optional)</span>
            <input
              value={placementLabel}
              onChange={(e) => setPlacementLabel(e.target.value)}
              placeholder="e.g. Front Door, Flyer, Instagram"
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-navy">Campaign</span>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
            >
              <option value="">No campaign</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={togglePause}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-5 py-2.5 text-sm font-semibold text-navy"
            >
              {status === "active" ? <Pause size={14} /> : <Play size={14} />}
              {status === "active" ? "Pause" : "Reactivate"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white p-5 text-center">
          <div className="flex min-h-[220px] items-center justify-center rounded-xl bg-paper p-4">
            {previewSrc ? (
              <img src={previewSrc} alt="QR code" className="h-48 w-48" />
            ) : (
              <p className="text-sm text-mute">No preview yet.</p>
            )}
          </div>
          <p className="mt-2 text-[11px] text-mute font-mono truncate">/q/{publicId}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDownload("png")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-navy"
            >
              <Download size={14} /> PNG
            </button>
            <button
              type="button"
              onClick={() => handleDownload("svg")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-semibold text-navy"
            >
              <Download size={14} /> SVG
            </button>
          </div>
        </section>
      </div>
    </PublisherShell>
  );
}
