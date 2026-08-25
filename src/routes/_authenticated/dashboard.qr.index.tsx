import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { QrCode, Plus, Pause, Play, Archive, Pencil, ScanLine, Copy, Megaphone } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { archiveQrProject, listMyQrProjects, updateQrProject } from "@/lib/qr.functions";
import { MAX_ACTIVE_DYNAMIC_QR } from "@/lib/qr";
import { duplicateQrProject } from "@/lib/qr-business.functions";

export const Route = createFileRoute("/_authenticated/dashboard/qr/")({
  component: QrDashboard,
});

const DESTINATION_LABEL: Record<string, string> = {
  url: "Website",
  email: "Email",
  tel: "Phone",
  sms: "Text message",
  text: "Plain text",
};

function QrDashboard() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMyQrProjects);
  const updateFn = useServerFn(updateQrProject);
  const archiveFn = useServerFn(archiveQrProject);
  const duplicateFn = useServerFn(duplicateQrProject);

  const { data, isLoading } = useQuery({
    queryKey: ["qr", "my-projects"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const projects = data ?? [];
  const activeDynamicCount = projects.filter(
    (p) => p.mode === "dynamic" && p.status !== "archived",
  ).length;

  async function togglePause(id: string, status: string) {
    try {
      await updateFn({ data: { id, status: status === "active" ? "paused" : "active" } });
      queryClient.invalidateQueries({ queryKey: ["qr", "my-projects"] });
      toast.success(status === "active" ? "QR code paused" : "QR code reactivated");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't update QR code");
    }
  }

  async function duplicate(id: string) {
    try {
      await duplicateFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["qr", "my-projects"] });
      toast.success("Copied — the new QR code tracks its own scans");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't duplicate QR code");
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this QR code? Its redirect will stop working.")) return;
    try {
      await archiveFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["qr", "my-projects"] });
      toast.success("QR code archived");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't archive QR code");
    }
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy">QR Codes</h1>
          <p className="text-mute text-sm mt-1">
            Create QR codes for your business — a link, phone number, or a code you can update
            anytime without reprinting it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/dashboard/qr/campaigns"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-semibold text-navy hover:bg-paper"
          >
            <Megaphone size={15} /> Campaigns
          </Link>
          <Link
            to="/dashboard/qr/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
          >
            <Plus size={15} /> Create a QR Code
          </Link>
        </div>
      </div>

      <p className="mt-3 text-xs text-mute">
        {activeDynamicCount}/{MAX_ACTIVE_DYNAMIC_QR} active dynamic QR codes used
      </p>

      {isLoading ? (
        <p className="mt-8 text-mute">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <QrCode className="mx-auto text-mute" size={32} />
          <p className="font-display text-xl text-navy mt-3">Create Your First QR Code</p>
          <p className="text-sm text-mute mt-2 max-w-md mx-auto">
            A <strong>Static</strong> QR code stores its destination directly in the image — quick
            and simple, but you'll need a new code if the destination changes. A{" "}
            <strong>Dynamic</strong> QR code goes through AurumVault, so you can change where it
            leads, pause it, and see how many times it's been scanned — all without reprinting.
          </p>
          <Link
            to="/dashboard/qr/new"
            className="inline-flex items-center gap-1.5 mt-5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:brightness-105"
          >
            <Plus size={15} /> Create a QR Code
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-ink/10 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-navy truncate">{p.name}</p>
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
                  <span className="shrink-0 rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-mute">
                    Dynamic
                  </span>
                </div>
                {p.placement_label && (
                  <p className="text-xs font-medium text-navy mt-1 truncate">
                    Placement: {p.placement_label}
                  </p>
                )}
                <p className="text-xs text-mute mt-1 truncate">
                  {DESTINATION_LABEL[p.destination_type] ?? p.destination_type} · Created{" "}
                  {new Date(p.created_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-mute mt-0.5 inline-flex items-center gap-1">
                  <ScanLine size={12} /> {p.scanCount} scan{p.scanCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to="/dashboard/qr/$id"
                  params={{ id: p.id }}
                  className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-paper"
                >
                  <Pencil size={13} /> Edit
                </Link>
                {p.status !== "archived" && (
                  <button
                    type="button"
                    onClick={() => duplicate(p.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-paper"
                  >
                    <Copy size={13} /> Duplicate
                  </button>
                )}
                {p.status !== "archived" && (
                  <button
                    type="button"
                    onClick={() => togglePause(p.id, p.status)}
                    className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-paper"
                  >
                    {p.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                    {p.status === "active" ? "Pause" : "Reactivate"}
                  </button>
                )}
                {p.status !== "archived" && (
                  <button
                    type="button"
                    onClick={() => archive(p.id)}
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
