import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Globe, Mail, Phone, MessageSquare, Type, Download } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  createQrProject,
  generateStaticQrImage,
  renderQrProjectImage,
  type QrRenderResult,
} from "@/lib/qr.functions";
import {
  DYNAMIC_QR_DESTINATION_TYPES,
  QR_DESTINATION_TYPES,
  type QrDestinationType,
} from "@/lib/qr";

export const Route = createFileRoute("/_authenticated/dashboard/qr/new")({
  component: CreateQrPage,
});

const TYPE_META: Record<
  QrDestinationType,
  { label: string; helper: string; icon: typeof Globe; placeholder: string }
> = {
  url: {
    label: "Send people to a website",
    helper: "A full web address.",
    icon: Globe,
    placeholder: "https://example.com",
  },
  email: {
    label: "Start an email",
    helper: "Their inbox opens, ready to send.",
    icon: Mail,
    placeholder: "you@example.com",
  },
  tel: {
    label: "Start a phone call",
    helper: "Their phone dialer opens.",
    icon: Phone,
    placeholder: "(555) 123-4567",
  },
  sms: {
    label: "Start a text message",
    helper: "Their messaging app opens.",
    icon: MessageSquare,
    placeholder: "(555) 123-4567",
  },
  text: {
    label: "Show plain text",
    helper: "For static QR codes only — no link, just text.",
    icon: Type,
    placeholder: "Welcome to our shop!",
  },
};

function downloadDataUrlOrSvg(result: QrRenderResult, filename: string) {
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

function CreateQrPage() {
  const navigate = useNavigate();
  const generateStaticFn = useServerFn(generateStaticQrImage);
  const createFn = useServerFn(createQrProject);
  const renderProjectFn = useServerFn(renderQrProjectImage);

  const [mode, setMode] = useState<"static" | "dynamic">("dynamic");
  const [destinationType, setDestinationType] = useState<QrDestinationType>("url");
  const [destination, setDestination] = useState("");
  const [name, setName] = useState("");
  const [foreground, setForeground] = useState("#1A2E4A");
  const [background, setBackground] = useState("#FFFFFF");
  const [preview, setPreview] = useState<QrRenderResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  const availableTypes = mode === "dynamic" ? DYNAMIC_QR_DESTINATION_TYPES : QR_DESTINATION_TYPES;

  const canPreview =
    destination.trim().length > 0 && (mode === "static" || destinationType !== "text");

  async function handlePreview() {
    if (!canPreview) return;
    setPreviewing(true);
    try {
      const result = await generateStaticFn({
        data: { destinationType, destination, format: "png", foreground, background },
      });
      setPreview(result);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't generate preview");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleDownloadStatic(format: "png" | "svg") {
    try {
      const result = await generateStaticFn({
        data: { destinationType, destination, format, foreground, background },
      });
      downloadDataUrlOrSvg(result, `qr-code.${format}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't generate QR code");
    }
  }

  async function handleSaveDynamic() {
    if (!name.trim()) return toast.error("Give your QR code a name");
    setSaving(true);
    try {
      const project = await createFn({
        data: { name, destinationType, destination, foreground, background },
      });
      setSavedProjectId(project.id);
      const result = await renderProjectFn({ data: { id: project.id, format: "png" } });
      setPreview(result);
      toast.success("Dynamic QR code saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save QR code");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadSaved(format: "png" | "svg") {
    if (!savedProjectId) return;
    try {
      const result = await renderProjectFn({ data: { id: savedProjectId, format } });
      downloadDataUrlOrSvg(result, `qr-code.${format}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't download QR code");
    }
  }

  const previewSrc = useMemo(() => {
    if (!preview) return null;
    return preview.format === "svg"
      ? `data:image/svg+xml;utf8,${encodeURIComponent(preview.data)}`
      : preview.data;
  }, [preview]);

  return (
    <PublisherShell accent={ACCENTS.help}>
      <Link
        to="/dashboard/qr"
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Back to QR Codes
      </Link>
      <h1 className="font-display text-3xl text-navy mt-3">Create a QR Code</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg text-navy">What should this QR code do?</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {availableTypes.map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                const active = destinationType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setDestinationType(t);
                      setPreview(null);
                      setSavedProjectId(null);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium ${
                      active
                        ? "border-navy bg-navy text-white"
                        : "border-ink/15 text-navy hover:bg-paper"
                    }`}
                  >
                    <Icon size={14} /> {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-mute">{TYPE_META[destinationType].helper}</p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-5 space-y-4">
            <h2 className="font-display text-lg text-navy">Destination</h2>
            <input
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setPreview(null);
                setSavedProjectId(null);
              }}
              placeholder={TYPE_META[destinationType].placeholder}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            />

            <div>
              <p className="text-sm font-medium text-navy mb-2">QR Type</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMode("static")}
                  className={`flex-1 min-w-[180px] rounded-lg border p-3 text-left ${
                    mode === "static" ? "border-navy bg-paper" : "border-ink/15"
                  }`}
                >
                  <p className="text-sm font-semibold text-navy">Static</p>
                  <p className="text-xs text-mute mt-0.5">
                    Destination is stored directly in the QR.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("dynamic");
                    if (destinationType === "text") setDestinationType("url");
                  }}
                  className={`flex-1 min-w-[180px] rounded-lg border p-3 text-left ${
                    mode === "dynamic" ? "border-navy bg-paper" : "border-ink/15"
                  }`}
                >
                  <p className="text-sm font-semibold text-navy">Dynamic</p>
                  <p className="text-xs text-mute mt-0.5">
                    Change the destination later and track scans.
                  </p>
                </button>
              </div>
            </div>

            {mode === "dynamic" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this QR code (e.g. Front Door Menu)"
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            )}
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg text-navy">Customize</h2>
            <div className="mt-3 flex flex-wrap gap-6">
              <label className="text-sm text-navy">
                Foreground
                <input
                  type="color"
                  value={foreground}
                  onChange={(e) => {
                    setForeground(e.target.value);
                    setPreview(null);
                  }}
                  className="block mt-1 h-10 w-16 rounded border border-ink/15"
                />
              </label>
              <label className="text-sm text-navy">
                Background
                <input
                  type="color"
                  value={background}
                  onChange={(e) => {
                    setBackground(e.target.value);
                    setPreview(null);
                  }}
                  className="block mt-1 h-10 w-16 rounded border border-ink/15"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-ink/10 bg-white p-5 text-center">
            <h2 className="font-display text-lg text-navy">Preview</h2>
            <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-xl bg-paper p-4">
              {previewSrc ? (
                <img src={previewSrc} alt="QR code preview" className="h-48 w-48" />
              ) : (
                <p className="text-sm text-mute">Enter a destination to preview your QR code.</p>
              )}
            </div>
            <button
              type="button"
              onClick={handlePreview}
              disabled={!canPreview || previewing}
              className="mt-3 w-full rounded-lg border border-ink/15 py-2.5 text-sm font-semibold text-navy disabled:opacity-50"
            >
              {previewing ? "Generating…" : "Test QR Code"}
            </button>

            {mode === "static" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadStatic("png")}
                  disabled={!canPreview}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
                >
                  <Download size={14} /> PNG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadStatic("svg")}
                  disabled={!canPreview}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-semibold text-navy disabled:opacity-50"
                >
                  <Download size={14} /> SVG
                </button>
              </div>
            ) : savedProjectId ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadSaved("png")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-navy"
                >
                  <Download size={14} /> PNG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSaved("svg")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-semibold text-navy"
                >
                  <Download size={14} /> SVG
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSaveDynamic}
                disabled={!destination.trim() || saving}
                className="mt-3 w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Dynamic QR"}
              </button>
            )}

            {savedProjectId && (
              <button
                type="button"
                onClick={() => navigate({ to: "/dashboard/qr" })}
                className="mt-2 w-full text-xs font-semibold text-mute hover:text-navy"
              >
                Done — view all QR codes
              </button>
            )}
          </section>
        </div>
      </div>
    </PublisherShell>
  );
}
