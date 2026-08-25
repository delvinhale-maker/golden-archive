import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Download, Sparkles, Store, Package, Check } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  createQrProject,
  generateStaticQrImage,
  renderQrProjectImage,
  type QrRenderResult,
} from "@/lib/qr.functions";
import {
  createQrShortcut,
  listMyQrCampaigns,
  listMyQrShortcutTargets,
} from "@/lib/qr-business.functions";
import {
  NICHE_KITS,
  QR_NICHES,
  USE_CASE_META,
  destinationTypeForUseCase,
  suggestedPlacements,
  type QrNiche,
  type QrUseCase,
} from "@/lib/qr-usecases";

export const Route = createFileRoute("/_authenticated/dashboard/qr/new")({
  component: CreateQrPage,
});

const PLACEHOLDER: Record<string, string> = {
  url: "https://example.com",
  email: "you@example.com",
  tel: "(555) 123-4567",
  sms: "(555) 123-4567",
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
  const shortcutFn = useServerFn(createQrShortcut);
  const renderProjectFn = useServerFn(renderQrProjectImage);
  const campaignsFn = useServerFn(listMyQrCampaigns);
  const targetsFn = useServerFn(listMyQrShortcutTargets);

  const { data: campaigns } = useQuery({
    queryKey: ["qr", "campaigns"],
    queryFn: () => campaignsFn(),
    staleTime: 30_000,
  });
  const { data: targets } = useQuery({
    queryKey: ["qr", "shortcut-targets"],
    queryFn: () => targetsFn(),
    staleTime: 60_000,
  });

  const [niche, setNiche] = useState<QrNiche>("general");
  const [useCase, setUseCase] = useState<QrUseCase>("storefront");
  const [destination, setDestination] = useState("");
  const [productId, setProductId] = useState("");
  const [name, setName] = useState(USE_CASE_META.storefront.suggestedName);
  const [placement, setPlacement] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [mode, setMode] = useState<"static" | "dynamic">("dynamic");
  const [foreground, setForeground] = useState("#1A2E4A");
  const [background, setBackground] = useState("#FFFFFF");
  const [preview, setPreview] = useState<QrRenderResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);

  const meta = USE_CASE_META[useCase];
  const destinationType = destinationTypeForUseCase(useCase);
  const shortcut = meta.shortcut;
  const kit = NICHE_KITS[niche];
  const placements = useMemo(() => suggestedPlacements(useCase, niche), [useCase, niche]);

  // Kits are opinionated starting sets: switching industry moves the owner to
  // that kit's first goal unless their current goal is already in the kit.
  useEffect(() => {
    if (!kit.useCases.includes(useCase)) setUseCase(kit.useCases[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche]);

  useEffect(() => {
    setName(USE_CASE_META[useCase].suggestedName);
    setDestination("");
    setPreview(null);
    setSavedProjectId(null);
    if (shortcut) setMode("dynamic");
  }, [useCase, shortcut]);

  const usingShortcut = Boolean(shortcut) && mode === "dynamic";
  const shortcutReady =
    shortcut === "storefront"
      ? Boolean(targets?.storefrontReady)
      : shortcut === "product"
        ? Boolean(productId)
        : false;
  const canSubmit = usingShortcut ? shortcutReady : destination.trim().length > 0;

  async function handlePreview() {
    if (!destination.trim()) {
      toast.error("Enter a destination first, or save it to preview a shortcut QR.");
      return;
    }
    setPreviewing(true);
    try {
      setPreview(
        await generateStaticFn({
          data: { destinationType, destination, format: "png", foreground, background },
        }),
      );
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
      const shared = {
        name,
        useCase,
        niche,
        campaignId: campaignId || null,
        placementLabel: placement || null,
        foreground,
        background,
      };
      const project = usingShortcut
        ? await shortcutFn({
            data: {
              ...shared,
              kind: shortcut as "storefront" | "product",
              ...(shortcut === "product" ? { productId } : {}),
            },
          })
        : await createFn({ data: { ...shared, destinationType, destination } });
      setSavedProjectId((project as any).id);
      setPreview(await renderProjectFn({ data: { id: (project as any).id, format: "png" } }));
      toast.success("QR code saved — you can change where it goes any time.");
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
      <p className="text-sm text-mute mt-1">
        Start with what you want to happen. We'll handle the rest.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg text-navy">What kind of business is this for?</h2>
            <p className="text-xs text-mute mt-1">
              We'll suggest the QR codes that work best in your industry.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {QR_NICHES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNiche(n)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${
                    niche === n
                      ? "border-navy bg-navy text-white"
                      : "border-ink/15 text-navy hover:bg-paper"
                  }`}
                >
                  {NICHE_KITS[n].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-mute">{kit.audience}</p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg text-navy">What should happen when it's scanned?</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {kit.useCases.map((uc) => {
                const m = USE_CASE_META[uc];
                const active = useCase === uc;
                return (
                  <button
                    key={uc}
                    type="button"
                    onClick={() => setUseCase(uc)}
                    className={`rounded-xl border p-3 text-left ${
                      active ? "border-navy bg-paper" : "border-ink/15 hover:bg-paper"
                    }`}
                  >
                    <p className="flex items-start gap-1.5 text-sm font-semibold text-navy">
                      {active ? (
                        <Check size={14} className="mt-0.5 shrink-0" />
                      ) : (
                        <Sparkles size={14} className="mt-0.5 shrink-0 text-mute" />
                      )}
                      {m.label}
                    </p>
                    <p className="mt-1 text-xs text-mute">{m.outcome}</p>
                  </button>
                );
              })}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-navy">
                Show every option
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(USE_CASE_META) as QrUseCase[])
                  .filter((uc) => !kit.useCases.includes(uc))
                  .map((uc) => (
                    <button
                      key={uc}
                      type="button"
                      onClick={() => setUseCase(uc)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        useCase === uc ? "border-navy bg-navy text-white" : "border-ink/15 text-navy"
                      }`}
                    >
                      {USE_CASE_META[uc].label}
                    </button>
                  ))}
              </div>
            </details>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-5 space-y-4">
            <h2 className="font-display text-lg text-navy">Where it goes</h2>

            {usingShortcut && shortcut === "storefront" && (
              <div className="rounded-xl border border-ink/10 bg-paper p-3">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
                  <Store size={14} /> Your AurumVault storefront
                </p>
                <p className="mt-1 text-xs text-mute">
                  {targets?.storefrontReady
                    ? "We'll point this QR at your storefront automatically — no link to copy."
                    : "Your storefront isn't ready yet. Finish setting it up, then come back."}
                </p>
              </div>
            )}

            {usingShortcut && shortcut === "product" && (
              <div className="rounded-xl border border-ink/10 bg-paper p-3">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
                  <Package size={14} /> Pick one of your products
                </p>
                {targets?.products.length ? (
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Choose a product…</option>
                    {targets.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-xs text-mute">
                    You don't have a live product yet. Publish one, then create its QR code.
                  </p>
                )}
              </div>
            )}

            {!usingShortcut && (
              <input
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setPreview(null);
                  setSavedProjectId(null);
                }}
                placeholder={PLACEHOLDER[destinationType] ?? "https://example.com"}
                className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              />
            )}

            <div>
              <p className="text-sm font-medium text-navy mb-2">QR type</p>
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
                  onClick={() => setMode("dynamic")}
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
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name this QR code"
                  className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                />

                <div>
                  <label className="text-sm font-medium text-navy">
                    Where will you put it? (optional)
                  </label>
                  <p className="text-xs text-mute mt-0.5">
                    Give each spot its own QR code and you'll see exactly which one gets used.
                  </p>
                  <input
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                    placeholder="e.g. Front window"
                    className="mt-2 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {placements.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlacement(p)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          placement === p
                            ? "border-navy bg-navy text-white"
                            : "border-ink/15 text-navy hover:bg-paper"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-navy">Campaign (optional)</label>
                  <select
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">No campaign</option>
                    {(campaigns ?? [])
                      .filter((c) => c.status === "active")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <Link
                    to="/dashboard/qr/campaigns"
                    className="mt-1 inline-block text-xs font-semibold text-navy underline"
                  >
                    Manage campaigns
                  </Link>
                </div>
              </div>
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
                <p className="text-sm text-mute">{meta.outcome}</p>
              )}
            </div>

            {!usingShortcut && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={!destination.trim() || previewing}
                className="mt-3 w-full rounded-lg border border-ink/15 py-2.5 text-sm font-semibold text-navy disabled:opacity-50"
              >
                {previewing ? "Generating…" : "Test QR Code"}
              </button>
            )}

            {mode === "static" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadStatic("png")}
                  disabled={!destination.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
                >
                  <Download size={14} /> PNG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadStatic("svg")}
                  disabled={!destination.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-semibold text-navy disabled:opacity-50"
                >
                  <Download size={14} /> SVG
                </button>
              </div>
            ) : savedProjectId ? (
              <>
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
                <button
                  type="button"
                  onClick={() => navigate({ to: "/dashboard/qr" })}
                  className="mt-2 w-full rounded-lg border border-ink/15 py-2.5 text-sm font-semibold text-navy"
                >
                  Done
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSaveDynamic}
                disabled={!canSubmit || saving}
                className="mt-3 w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save QR Code"}
              </button>
            )}
          </section>
        </div>
      </div>
    </PublisherShell>
  );
}
