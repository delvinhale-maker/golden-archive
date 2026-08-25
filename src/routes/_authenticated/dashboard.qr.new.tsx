import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Globe,
  Mail,
  Phone,
  MessageSquare,
  Type,
  Download,
  Sparkles,
  Compass,
  Zap,
} from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  createQrProject,
  generateStaticQrImage,
  renderQrProjectImage,
  type QrRenderResult,
} from "@/lib/qr.functions";
import { listMyQrCampaigns } from "@/lib/qr-campaigns.functions";
import {
  createStorefrontQrShortcut,
  createProductQrShortcut,
  listMyEligibleProducts,
} from "@/lib/qr-shortcuts.functions";
import {
  DYNAMIC_QR_DESTINATION_TYPES,
  QR_DESTINATION_TYPES,
  type QrDestinationType,
  type QrMode,
} from "@/lib/qr";
import { QR_USE_CASES, type QrUseCaseId } from "@/lib/qr-use-cases";
import { QR_NICHES, type QrNicheId } from "@/lib/qr-niches";

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

type EntryMode = "menu" | "quick" | "business" | "kit-niche" | "kit-outcome";

/** Native AurumVault shortcuts, surfaced only under the Creator kit. */
const CREATOR_SHORTCUT_USE_CASES: QrUseCaseId[] = ["visit_store", "buy_product"];

function CreateQrPage() {
  const navigate = useNavigate();
  const generateStaticFn = useServerFn(generateStaticQrImage);
  const createFn = useServerFn(createQrProject);
  const renderProjectFn = useServerFn(renderQrProjectImage);
  const listCampaignsFn = useServerFn(listMyQrCampaigns);
  const storefrontShortcutFn = useServerFn(createStorefrontQrShortcut);
  const productShortcutFn = useServerFn(createProductQrShortcut);
  const listProductsFn = useServerFn(listMyEligibleProducts);

  const [entry, setEntry] = useState<EntryMode>("menu");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState<QrNicheId | null>(null);
  const [selectedUseCase, setSelectedUseCase] = useState<QrUseCaseId | null>(null);

  const [mode, setMode] = useState<QrMode>("dynamic");
  const [destinationType, setDestinationType] = useState<QrDestinationType>("url");
  const [destination, setDestination] = useState("");
  const [destinationLocked, setDestinationLocked] = useState(false);
  const [name, setName] = useState("");
  const [placementLabel, setPlacementLabel] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [foreground, setForeground] = useState("#1A2E4A");
  const [background, setBackground] = useState("#FFFFFF");
  const [preview, setPreview] = useState<QrRenderResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [shortcutLoading, setShortcutLoading] = useState(false);

  const { data: campaigns } = useQuery({
    queryKey: ["qr", "my-campaigns"],
    queryFn: () => listCampaignsFn(),
    staleTime: 30_000,
    enabled: entry !== "menu",
  });

  const { data: eligibleProducts } = useQuery({
    queryKey: ["qr", "my-eligible-products"],
    queryFn: () => listProductsFn(),
    staleTime: 30_000,
    enabled: showProductPicker,
  });

  const availableTypes = mode === "dynamic" ? DYNAMIC_QR_DESTINATION_TYPES : QR_DESTINATION_TYPES;
  const canPreview =
    destination.trim().length > 0 && (mode === "static" || destinationType !== "text");

  function resetOutputState() {
    setPreview(null);
    setSavedProjectId(null);
  }

  function applyUseCase(useCaseId: QrUseCaseId) {
    const uc = QR_USE_CASES[useCaseId];
    setSelectedUseCase(useCaseId);
    setDestinationType(uc.destinationType);
    setMode(uc.suggestedMode);
    setDestinationLocked(false);
    setDestination("");
    resetOutputState();
    setEntry("business");
  }

  async function applyShortcut(useCaseId: "visit_store" | "buy_product", productId?: string) {
    setShortcutLoading(true);
    try {
      const result =
        useCaseId === "visit_store"
          ? await storefrontShortcutFn()
          : await productShortcutFn({ data: { productId: productId! } });
      setSelectedUseCase(useCaseId);
      setDestinationType("url");
      setMode("dynamic");
      setDestination(result.destination);
      setDestinationLocked(true);
      setName(result.suggestedName);
      resetOutputState();
      setEntry("business");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't set up that shortcut");
    } finally {
      setShortcutLoading(false);
    }
  }

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
        data: {
          name,
          destinationType,
          destination,
          foreground,
          background,
          useCase: selectedUseCase ?? undefined,
          niche: selectedNiche ?? undefined,
          campaignId: campaignId || undefined,
          placementLabel: placementLabel || undefined,
        },
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

  const useCase = selectedUseCase ? QR_USE_CASES[selectedUseCase] : null;

  // ---- Entry menu: Quick QR / Business QR / Industry Kit ----
  if (entry === "menu") {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <Link
          to="/dashboard/qr"
          className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
        >
          <ArrowLeft size={14} /> Back to QR Codes
        </Link>
        <h1 className="font-display text-3xl text-navy mt-3">What are you creating today?</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setEntry("quick")}
            className="rounded-2xl border border-ink/10 bg-white p-6 text-left hover:border-navy/40"
          >
            <Zap className="text-navy" size={22} />
            <p className="font-display text-lg text-navy mt-3">Quick QR</p>
            <p className="text-sm text-mute mt-1">I already know the link.</p>
          </button>
          <button
            type="button"
            onClick={() => setEntry("business")}
            className="rounded-2xl border border-ink/10 bg-white p-6 text-left hover:border-navy/40"
          >
            <Sparkles className="text-navy" size={22} />
            <p className="font-display text-lg text-navy mt-3">Business QR</p>
            <p className="text-sm text-mute mt-1">Help me choose what this should do.</p>
          </button>
          <button
            type="button"
            onClick={() => setEntry("kit-niche")}
            className="rounded-2xl border border-ink/10 bg-white p-6 text-left hover:border-navy/40"
          >
            <Compass className="text-navy" size={22} />
            <p className="font-display text-lg text-navy mt-3">Industry Kit</p>
            <p className="text-sm text-mute mt-1">Show me the best QR workflows for my business.</p>
          </button>
        </div>
      </PublisherShell>
    );
  }

  // ---- Industry Kit: pick a niche, then an outcome from that niche ----
  if (entry === "kit-niche") {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <button
          type="button"
          onClick={() => setEntry("menu")}
          className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="font-display text-3xl text-navy mt-3">What's your business?</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Object.values(QR_NICHES).map((niche) => (
            <button
              key={niche.id}
              type="button"
              onClick={() => {
                setSelectedNiche(niche.id);
                setEntry("kit-outcome");
              }}
              className="rounded-2xl border border-ink/10 bg-white p-5 text-left hover:border-navy/40"
            >
              <p className="font-display text-lg text-navy">{niche.label}</p>
              <p className="text-sm text-mute mt-1">{niche.description}</p>
            </button>
          ))}
        </div>
      </PublisherShell>
    );
  }

  if (entry === "kit-outcome" && selectedNiche) {
    const niche = QR_NICHES[selectedNiche];
    const isCreator = selectedNiche === "creator";
    return (
      <PublisherShell accent={ACCENTS.help}>
        <button
          type="button"
          onClick={() => setEntry("kit-niche")}
          className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="font-display text-3xl text-navy mt-3">{niche.label} QR ideas</h1>
        <p className="text-sm text-mute mt-1">What do you want people to do?</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {niche.useCaseIds.map((id) => {
            const uc = QR_USE_CASES[id];
            const isCreatorShortcut = isCreator && CREATOR_SHORTCUT_USE_CASES.includes(id);
            return (
              <button
                key={id}
                type="button"
                disabled={shortcutLoading}
                onClick={() =>
                  isCreatorShortcut
                    ? id === "visit_store"
                      ? void applyShortcut("visit_store")
                      : setShowProductPicker(true)
                    : applyUseCase(id)
                }
                className="rounded-xl border border-ink/10 bg-white p-4 text-left hover:border-navy/40 disabled:opacity-50"
              >
                <p className="text-sm font-semibold text-navy">{uc.label}</p>
                <p className="text-xs text-mute mt-1">{uc.description}</p>
                {isCreatorShortcut && (
                  <p className="text-[11px] text-mute mt-1 italic">
                    {id === "visit_store"
                      ? "Auto-fills your storefront link."
                      : "Choose one of your published products."}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {showProductPicker && (
          <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg text-navy">Which product?</h2>
            {eligibleProducts === undefined ? (
              <p className="text-sm text-mute mt-2">Loading your products…</p>
            ) : eligibleProducts.length === 0 ? (
              <p className="text-sm text-mute mt-2">
                You don't have any approved, published products yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {eligibleProducts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={shortcutLoading}
                      onClick={() => void applyShortcut("buy_product", p.id)}
                      className="w-full rounded-lg border border-ink/15 px-3 py-2 text-left text-sm text-navy hover:bg-paper disabled:opacity-50"
                    >
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PublisherShell>
    );
  }

  // ---- Business QR: pick a goal directly (no niche) ----
  if (entry === "business" && !useCase && !destinationLocked) {
    return (
      <PublisherShell accent={ACCENTS.help}>
        <button
          type="button"
          onClick={() => setEntry("menu")}
          className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="font-display text-3xl text-navy mt-3">What do you want people to do?</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Object.values(QR_USE_CASES).map((uc) => (
            <button
              key={uc.id}
              type="button"
              onClick={() => applyUseCase(uc.id)}
              className="rounded-xl border border-ink/10 bg-white p-4 text-left hover:border-navy/40"
            >
              <p className="text-sm font-semibold text-navy">{uc.label}</p>
              <p className="text-xs text-mute mt-1">{uc.description}</p>
            </button>
          ))}
        </div>
      </PublisherShell>
    );
  }

  // ---- Shared build form (Quick QR lands here directly; Business QR / Industry
  // Kit land here after a goal is chosen, prefilled) ----
  return (
    <PublisherShell accent={ACCENTS.help}>
      <button
        type="button"
        onClick={() => setEntry("menu")}
        className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
      >
        <ArrowLeft size={14} /> Start Over
      </button>
      <h1 className="font-display text-3xl text-navy mt-3">Create a QR Code</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {useCase && (
            <section className="rounded-2xl border border-navy/20 bg-paper p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-navy/60">Goal</p>
              <p className="font-display text-lg text-navy mt-1">{useCase.label}</p>
              <p className="text-sm text-mute mt-1">{useCase.helperCopy}</p>
              {useCase.ctaExamples.length > 0 && (
                <p className="text-xs text-mute mt-2 italic">"{useCase.ctaExamples[0]}"</p>
              )}
            </section>
          )}

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
                    disabled={destinationLocked}
                    onClick={() => {
                      setDestinationType(t);
                      resetOutputState();
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
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
              disabled={destinationLocked}
              onChange={(e) => {
                setDestination(e.target.value);
                resetOutputState();
              }}
              placeholder={TYPE_META[destinationType].placeholder}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm disabled:bg-paper disabled:text-mute"
            />
            {destinationLocked && (
              <p className="text-xs text-mute">
                Auto-filled from your AurumVault account — this always points to your own store or
                product.
              </p>
            )}

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
                    Best when this destination will not need to change.
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
                    Best when you may want to update the destination or track scans.
                  </p>
                </button>
              </div>
            </div>

            {mode === "dynamic" && (
              <>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name this QR code (e.g. Front Door Menu)"
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
                <input
                  value={placementLabel}
                  onChange={(e) => setPlacementLabel(e.target.value)}
                  placeholder="Placement (optional — e.g. Front Door, Flyer, Instagram)"
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-navy"
                >
                  <option value="">No campaign</option>
                  {(campaigns ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Link
                  to="/dashboard/qr/campaigns"
                  className="inline-block text-xs font-semibold text-navy hover:underline"
                >
                  + Create a new campaign
                </Link>
              </>
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
