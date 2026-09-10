import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  FileImage,
  Film,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { supabase } from "@/integrations/supabase/client";
import {
  completeCreatorStudioAssetUpload,
  getCreatorStudioProject,
  listCreatorStudioSourceProducts,
  removeCreatorStudioAsset,
  requestCreatorStudioAssetUpload,
  selectCreatorStudioSourceProduct,
  setCreatorStudioProjectStatus,
  updateCreatorStudioProject,
} from "@/lib/creator-studio.functions";
import {
  CREATOR_STUDIO_ASSET_LIMITS,
  CREATOR_STUDIO_DURATIONS,
  CREATOR_STUDIO_PROJECT_TYPE_LABELS,
  CREATOR_STUDIO_STYLE_LABELS,
  type CreatorStudioAssetCategory,
  type CreatorStudioAsset,
  type CreatorStudioProject,
  type CreatorStudioSourceProduct,
  type CreatorStudioStyle,
} from "@/lib/creator-studio.schema";

export const Route = createFileRoute("/_authenticated/creator-studio/$projectId")({
  component: CreatorStudioProjectRoute,
});

const STEP_LABELS = [
  "Create",
  "Product",
  "Assets",
  "Message",
  "Style",
  "Duration",
  "Generate",
];

function CreatorStudioProjectRoute() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const getProject = useServerFn(getCreatorStudioProject);
  const listProducts = useServerFn(listCreatorStudioSourceProducts);
  const updateProject = useServerFn(updateCreatorStudioProject);
  const selectProduct = useServerFn(selectCreatorStudioSourceProduct);
  const setStatus = useServerFn(setCreatorStudioProjectStatus);
  const requestUpload = useServerFn(requestCreatorStudioAssetUpload);
  const completeUpload = useServerFn(completeCreatorStudioAssetUpload);
  const removeAsset = useServerFn(removeCreatorStudioAsset);

  const projectQuery = useQuery({
    queryKey: ["creator-studio", "project", projectId],
    queryFn: () => getProject({ data: { projectId } }),
    retry: false,
  });
  const productsQuery = useQuery({
    queryKey: ["creator-studio", "source-products"],
    queryFn: () => listProducts(),
    retry: false,
  });

  const [step, setStep] = useState(2);
  const initialized = useRef(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCategory, setUploadingCategory] =
    useState<CreatorStudioAssetCategory | null>(null);
  const [externalMode, setExternalMode] = useState(false);
  const [productTitle, setProductTitle] = useState("");
  const [price, setPrice] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");

  const data = projectQuery.data;
  const project = data?.project;
  const assets = data?.assets ?? [];

  useEffect(() => {
    if (!project || initialized.current) return;
    initialized.current = true;
    setStep(Math.max(2, Math.min(7, project.wizard_step || 2)));
    setExternalMode(!project.source_product_id);
    setProductTitle(project.product_title ?? "");
    setPrice(project.price_cents == null ? "" : (project.price_cents / 100).toFixed(2));
    setDestinationUrl(project.destination_url ?? "");
    setHook(project.hook ?? "");
    setCta(project.cta ?? "");
  }, [project]);

  async function refreshProject() {
    await queryClient.invalidateQueries({
      queryKey: ["creator-studio", "project", projectId],
    });
    await queryClient.invalidateQueries({ queryKey: ["creator-studio", "projects"] });
  }

  async function savePatch(patch: Record<string, unknown>, nextStep?: number) {
    setSaving(true);
    try {
      await updateProject({
        data: {
          id: projectId,
          ...patch,
          ...(nextStep ? { wizardStep: nextStep } : {}),
        } as never,
      });
      if (nextStep) setStep(nextStep);
      await refreshProject();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creator Studio could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseProduct(productId: string | null) {
    setSaving(true);
    try {
      const updated = await selectProduct({ data: { projectId, productId } });
      setExternalMode(productId === null);
      setProductTitle(updated.product_title ?? "");
      setPrice(updated.price_cents == null ? "" : (updated.price_cents / 100).toFixed(2));
      setDestinationUrl(updated.destination_url ?? "");
      await refreshProject();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Product selection failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveExternalProduct() {
    const priceCents =
      price.trim() === "" ? null : Math.max(0, Math.round(Number(price) * 100));
    if (!productTitle.trim()) {
      toast.error("Add a product title.");
      return;
    }
    if (price.trim() !== "" && !Number.isFinite(priceCents)) {
      toast.error("Enter a valid price or leave it blank.");
      return;
    }
    await savePatch(
      {
        productTitle: productTitle.trim(),
        priceCents,
        destinationUrl: destinationUrl.trim() || null,
      },
      3,
    );
  }

  async function readImageDimensions(file: File) {
    if (!file.type.startsWith("image/")) return { width: null, height: null };
    return new Promise<{ width: number | null; height: number | null }>((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        resolve({ width: null, height: null });
        URL.revokeObjectURL(url);
      };
      image.src = url;
    });
  }

  async function handleAssetFile(
    category: CreatorStudioAssetCategory,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingCategory(category);
    try {
      const ticket = await requestUpload({
        data: {
          projectId,
          category,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          byteSize: file.size,
        },
      });

      const uploaded = await supabase.storage
        .from("creator-studio-assets")
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: ticket.contentType,
        });
      if (uploaded.error) throw uploaded.error;

      const dimensions = await readImageDimensions(file);
      await completeUpload({
        data: {
          assetId: ticket.assetId,
          width: dimensions.width,
          height: dimensions.height,
        },
      });
      toast.success("Asset added securely.");
      await refreshProject();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Asset upload failed.");
    } finally {
      setUploadingCategory(null);
    }
  }

  async function deleteAsset(assetId: string) {
    setSaving(true);
    try {
      const result = await removeAsset({ data: { assetId } });
      if (result.storageCleanupPending) {
        toast.warning("Asset removed. Private storage cleanup was queued for follow-up.");
      } else {
        toast.success("Asset removed.");
      }
      await refreshProject();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Asset removal failed.");
    } finally {
      setSaving(false);
    }
  }

  async function validateReady() {
    setSaving(true);
    try {
      await setStatus({ data: { projectId, status: "READY" } });
      toast.success("Project is ready for the rendering phase.");
      await refreshProject();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project is not ready yet.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrResume() {
    if (!project) return;
    setSaving(true);
    try {
      await setStatus({
        data: {
          projectId,
          status: project.status === "CANCELLED" ? "DRAFT" : "CANCELLED",
        },
      });
      await refreshProject();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status change failed.");
    } finally {
      setSaving(false);
    }
  }

  if (projectQuery.isLoading) {
    return (
      <PublisherShell accent={ACCENTS.creatorStudio}>
        <div className="flex items-center gap-2 text-sm text-mute">
          <Loader2 className="animate-spin" size={16} aria-hidden /> Loading Creator Studio…
        </div>
      </PublisherShell>
    );
  }

  if (!project || projectQuery.error) {
    return (
      <PublisherShell accent={ACCENTS.creatorStudio}>
        <p role="alert" className="text-sm text-red-700">
          This Creator Studio project could not be loaded.
        </p>
        <Link to="/creator-studio" className="mt-4 inline-flex text-sm font-semibold text-navy">
          Back to Creator Studio
        </Link>
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/creator-studio"
              className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
            >
              <ArrowLeft size={14} aria-hidden /> Creator Studio
            </Link>
            <h1 className="mt-2 font-display text-3xl text-navy">
              {project.product_title || project.title}
            </h1>
            <p className="mt-1 text-sm text-mute">
              {CREATOR_STUDIO_PROJECT_TYPE_LABELS[project.project_type]} · 9:16 ·{" "}
              {project.status}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void cancelOrResume()}
            className="rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-semibold text-navy disabled:opacity-50"
          >
            {project.status === "CANCELLED" ? "Resume project" : "Cancel project"}
          </button>
        </div>

        <ol className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Creator Studio steps">
          {STEP_LABELS.map((label, index) => {
            const n = index + 1;
            const active = n === step;
            const complete = n < step;
            return (
              <li key={label} className="shrink-0">
                <button
                  type="button"
                  onClick={() => n >= 2 && setStep(n)}
                  disabled={n === 1}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${
                    active
                      ? "bg-navy text-white"
                      : complete
                        ? "bg-gold/15 text-navy"
                        : "border border-ink/10 bg-white text-mute"
                  }`}
                >
                  {complete ? "✓ " : ""}
                  {n}. {label}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 rounded-3xl border border-ink/10 bg-white p-5 shadow-sm md:p-7">
          {project.status === "CANCELLED" ? (
            <div className="py-10 text-center">
              <Film className="mx-auto text-mute" aria-hidden />
              <h2 className="mt-3 font-display text-2xl text-navy">Project cancelled</h2>
              <p className="mt-2 text-sm text-mute">
                Your project and private assets are preserved. Resume it to keep editing.
              </p>
            </div>
          ) : step === 2 ? (
            <ProductStep
              project={project}
              products={productsQuery.data ?? []}
              loading={productsQuery.isLoading || saving}
              externalMode={externalMode}
              productTitle={productTitle}
              price={price}
              destinationUrl={destinationUrl}
              onExternalMode={() => void chooseProduct(null)}
              onChoose={(id) => void chooseProduct(id)}
              onProductTitle={setProductTitle}
              onPrice={setPrice}
              onDestinationUrl={setDestinationUrl}
              onContinue={() =>
                externalMode ? void saveExternalProduct() : void savePatch({}, 3)
              }
            />
          ) : step === 3 ? (
            <AssetsStep
              assets={assets}
              uploadingCategory={uploadingCategory}
              onUpload={handleAssetFile}
              onDelete={(id) => void deleteAsset(id)}
              onContinue={() => void savePatch({}, 4)}
            />
          ) : step === 4 ? (
            <MessageStep
              hook={hook}
              cta={cta}
              price={price}
              destinationUrl={destinationUrl}
              onHook={setHook}
              onCta={setCta}
              onPrice={setPrice}
              onDestinationUrl={setDestinationUrl}
              onContinue={() =>
                void savePatch(
                  {
                    hook: hook.trim() || null,
                    cta: cta.trim() || null,
                    destinationUrl: destinationUrl.trim() || null,
                    priceCents:
                      price.trim() === ""
                        ? null
                        : Math.max(0, Math.round(Number(price) * 100)),
                  },
                  5,
                )
              }
            />
          ) : step === 5 ? (
            <StyleStep
              selected={project.style_key}
              onSelect={(styleKey) => void savePatch({ styleKey }, 6)}
            />
          ) : step === 6 ? (
            <DurationStep
              selected={project.duration_seconds}
              onSelect={(durationSeconds) => void savePatch({ durationSeconds }, 7)}
            />
          ) : (
            <GenerateStep
              project={project}
              assets={assets}
              sourceProductHasCover={
                !!(productsQuery.data ?? []).find(
                  (product) => product.id === project.source_product_id,
                )?.cover_url
              }
              saving={saving}
              onValidate={() => void validateReady()}
            />
          )}
        </div>
      </div>
    </PublisherShell>
  );
}

function ProductStep({
  project,
  products,
  loading,
  externalMode,
  productTitle,
  price,
  destinationUrl,
  onExternalMode,
  onChoose,
  onProductTitle,
  onPrice,
  onDestinationUrl,
  onContinue,
}: {
  project: CreatorStudioProject;
  products: CreatorStudioSourceProduct[];
  loading: boolean;
  externalMode: boolean;
  productTitle: string;
  price: string;
  destinationUrl: string;
  onExternalMode: () => void;
  onChoose: (id: string) => void;
  onProductTitle: (value: string) => void;
  onPrice: (value: string) => void;
  onDestinationUrl: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Step 2</p>
      <h2 className="mt-1 font-display text-2xl text-navy">Choose your product</h2>
      <p className="mt-2 text-sm text-mute">
        Reuse an approved AurumVault listing or enter an external product.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            disabled={loading}
            onClick={() => onChoose(product.id)}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${
              project.source_product_id === product.id
                ? "border-gold bg-gold/5"
                : "border-ink/10 bg-white"
            }`}
          >
            {product.cover_url ? (
              <img
                src={product.cover_url}
                alt=""
                className="h-20 w-14 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-20 w-14 items-center justify-center rounded bg-ink/5">
                <FileImage size={18} className="text-mute" aria-hidden />
              </div>
            )}
            <span className="min-w-0">
              <strong className="block truncate text-sm text-navy">{product.title}</strong>
              <span className="mt-1 block text-xs text-mute">
                ${(product.price_cents / 100).toFixed(2)}
                {product.creator_name ? ` · ${product.creator_name}` : ""}
              </span>
              {product.preview_urls.length > 0 && (
                <span
                  className="mt-2 flex gap-1"
                  aria-label={`${product.preview_urls.length} product previews available`}
                >
                  {product.preview_urls.slice(0, 3).map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      loading="lazy"
                      className="h-8 w-8 rounded object-cover"
                    />
                  ))}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onExternalMode}
        className="mt-5 text-sm font-semibold text-navy underline decoration-gold underline-offset-4"
      >
        Use an external product instead
      </button>

      {externalMode && (
        <div className="mt-4 grid gap-4 rounded-2xl bg-ink/[0.03] p-4">
          <Field label="Product title">
            <input
              value={productTitle}
              maxLength={180}
              onChange={(event) => onProductTitle(event.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm text-navy"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Optional price">
              <input
                value={price}
                inputMode="decimal"
                placeholder="19.99"
                onChange={(event) => onPrice(event.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm text-navy"
              />
            </Field>
            <Field label="Optional product URL">
              <input
                value={destinationUrl}
                placeholder="https://…"
                onChange={(event) => onDestinationUrl(event.target.value)}
                className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm text-navy"
              />
            </Field>
          </div>
        </div>
      )}

      <ContinueButton loading={loading} onClick={onContinue} />
    </section>
  );
}

function AssetsStep({
  assets,
  uploadingCategory,
  onUpload,
  onDelete,
  onContinue,
}: {
  assets: CreatorStudioAsset[];
  uploadingCategory: CreatorStudioAssetCategory | null;
  onUpload: (
    category: CreatorStudioAssetCategory,
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  onDelete: (id: string) => void;
  onContinue: () => void;
}) {
  const categories: { key: CreatorStudioAssetCategory; label: string; accept: string }[] = [
    { key: "PRODUCT_COVER", label: "Product cover", accept: "image/jpeg,image/png,image/webp" },
    { key: "SCREENSHOT", label: "Screenshots", accept: "image/jpeg,image/png,image/webp" },
    { key: "LOGO", label: "Logo", accept: "image/jpeg,image/png,image/webp" },
    {
      key: "ADDITIONAL_MEDIA",
      label: "Additional media",
      accept: "image/jpeg,image/png,image/webp,video/mp4",
    },
  ];

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Step 3</p>
      <h2 className="mt-1 font-display text-2xl text-navy">Add your assets</h2>
      <p className="mt-2 text-sm text-mute">
        Files stay private. Each file is limited to 50 MB; this V1 project allows one
        cover, eight screenshots, one logo, and four additional media files.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {categories.map((category) => {
          const count = assets.filter((asset) => asset.category === category.key).length;
          const atLimit = count >= CREATOR_STUDIO_ASSET_LIMITS[category.key];
          return (
            <label
              key={category.key}
              className={`rounded-2xl border border-dashed p-4 ${
                atLimit ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-gold"
              }`}
            >
              <input
                type="file"
                className="sr-only"
                accept={category.accept}
                disabled={atLimit || uploadingCategory !== null}
                onChange={(event) => onUpload(category.key, event)}
              />
              <div className="flex items-center gap-2">
                {uploadingCategory === category.key ? (
                  <Loader2 size={17} className="animate-spin text-gold" aria-hidden />
                ) : (
                  <Upload size={17} className="text-gold" aria-hidden />
                )}
                <span className="text-sm font-semibold text-navy">{category.label}</span>
              </div>
              <p className="mt-2 text-xs text-mute">
                {count}/{CREATOR_STUDIO_ASSET_LIMITS[category.key]}
              </p>
            </label>
          );
        })}
      </div>

      {assets.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-3 rounded-xl border border-ink/10 p-3"
            >
              {asset.preview_url && asset.mime_type.startsWith("image/") ? (
                <img
                  src={asset.preview_url}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-ink/5">
                  <FileImage size={18} className="text-mute" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">
                  {asset.original_filename}
                </p>
                <p className="mt-1 text-xs text-mute">
                  {asset.category.replaceAll("_", " ")} ·{" "}
                  {(asset.byte_size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(asset.id)}
                className="rounded-full p-2 text-mute hover:bg-red-50 hover:text-red-700"
                aria-label={`Remove ${asset.original_filename}`}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <ContinueButton loading={uploadingCategory !== null} onClick={onContinue} />
    </section>
  );
}

function MessageStep({
  hook,
  cta,
  price,
  destinationUrl,
  onHook,
  onCta,
  onPrice,
  onDestinationUrl,
  onContinue,
}: {
  hook: string;
  cta: string;
  price: string;
  destinationUrl: string;
  onHook: (value: string) => void;
  onCta: (value: string) => void;
  onPrice: (value: string) => void;
  onDestinationUrl: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Step 4</p>
      <h2 className="mt-1 font-display text-2xl text-navy">Shape the message</h2>
      <div className="mt-5 grid gap-4">
        <Field label="Headline / hook">
          <input
            value={hook}
            maxLength={240}
            onChange={(event) => onHook(event.target.value)}
            placeholder="A clear reason to stop scrolling"
            className="w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm text-navy"
          />
        </Field>
        <Field label="Call to action">
          <input
            value={cta}
            maxLength={120}
            onChange={(event) => onCta(event.target.value)}
            placeholder="Shop now"
            className="w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm text-navy"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Optional price">
            <input
              value={price}
              inputMode="decimal"
              onChange={(event) => onPrice(event.target.value)}
              className="w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm text-navy"
            />
          </Field>
          <Field label="Optional product URL">
            <input
              value={destinationUrl}
              onChange={(event) => onDestinationUrl(event.target.value)}
              className="w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm text-navy"
            />
          </Field>
        </div>
      </div>
      <ContinueButton loading={false} onClick={onContinue} />
    </section>
  );
}

function StyleStep({
  selected,
  onSelect,
}: {
  selected: CreatorStudioStyle;
  onSelect: (style: CreatorStudioStyle) => void;
}) {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Step 5</p>
      <h2 className="mt-1 font-display text-2xl text-navy">Choose a style</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.entries(CREATOR_STUDIO_STYLE_LABELS) as [CreatorStudioStyle, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`rounded-2xl border p-5 text-left text-sm font-semibold ${
                selected === key ? "border-gold bg-gold/5 text-navy" : "border-ink/10 text-navy"
              }`}
            >
              {selected === key && <Check size={16} className="mb-3 text-gold" aria-hidden />}
              {label}
            </button>
          ),
        )}
      </div>
    </section>
  );
}

function DurationStep({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (duration: 15 | 30 | 45) => void;
}) {
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Step 6</p>
      <h2 className="mt-1 font-display text-2xl text-navy">Choose duration</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {CREATOR_STUDIO_DURATIONS.map((duration) => (
          <button
            key={duration}
            type="button"
            onClick={() => onSelect(duration)}
            className={`rounded-2xl border p-6 text-center ${
              selected === duration ? "border-gold bg-gold/5" : "border-ink/10"
            }`}
          >
            <strong className="font-display text-3xl text-navy">{duration}</strong>
            <span className="ml-1 text-sm text-mute">sec</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GenerateStep({
  project,
  assets,
  sourceProductHasCover,
  saving,
  onValidate,
}: {
  project: CreatorStudioProject;
  assets: CreatorStudioAsset[];
  sourceProductHasCover: boolean;
  saving: boolean;
  onValidate: () => void;
}) {
  const coverReady =
    assets.some((asset) => asset.category === "PRODUCT_COVER" && asset.state === "READY") ||
    sourceProductHasCover;
  const checks = [
    ["Product title", !!project.product_title?.trim()],
    ["Cover", coverReady],
    ["Headline / hook", !!project.hook?.trim()],
    ["Call to action", !!project.cta?.trim()],
    ["Style", !!project.style_key],
    ["Duration", [15, 30, 45].includes(project.duration_seconds)],
  ] as const;

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Step 7</p>
      <h2 className="mt-1 font-display text-2xl text-navy">Review before generation</h2>
      <p className="mt-2 text-sm text-mute">
        CS1 validates and saves the creative brief only. Rendering is deliberately unavailable
        until the provider-independent template engine and server-only provider adapter are built.
      </p>

      <div className="mt-5 grid gap-2">
        {checks.map(([label, ok]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border border-ink/10 px-4 py-3"
          >
            <span className="text-sm text-navy">{label}</span>
            <span className={ok ? "text-emerald-700" : "text-mute"}>
              {ok ? "Ready" : "Needed"}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={onValidate}
        className="mt-6 rounded-full border border-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
      >
        {saving
          ? "Validating…"
          : project.status === "READY"
            ? "Revalidate project"
            : "Validate project readiness"}
      </button>

      <button
        type="button"
        disabled
        className="ml-3 mt-6 rounded-full bg-navy px-6 py-2.5 text-sm font-bold text-white opacity-50"
        title="Rendering is intentionally not connected in CS1."
      >
        Generate video
      </button>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-navy">
      {label}
      {children}
    </label>
  );
}

function ContinueButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      Continue
    </button>
  );
}
