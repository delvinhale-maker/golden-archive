import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  listCanvaDesignsFn,
  previewCanvaDesignFn,
  turnCanvaDesignIntoProductFn,
} from "@/lib/canva-designs.functions";
import type { CanvaApiFailureReason } from "@/lib/canva-oauth";

/**
 * Canva design browse -> preview -> "Turn Into Product" flow. Replaces the
 * former placeholder ImportDialog in CanvaConnectBanner.
 *
 * Every Canva API call (list/preview/export) happens server-side through
 * canva-designs.functions.ts — no Canva token, refresh token, or client
 * secret ever reaches this component. This component only ever sees the
 * same non-secret design metadata a signed-in Canva user would see in their
 * own browser (thumbnail, title, timestamps).
 *
 * "Turn Into Product" always lands the creator in the EXISTING product
 * editor (/dashboard/new?id=...) with a DRAFT — never publishes anything
 * automatically.
 */

const FAILURE_MESSAGES: Record<CanvaApiFailureReason, string> = {
  not_connected: "Canva isn't connected. Reconnect to browse your designs.",
  reauth_required: "Your Canva authorization has expired. Reconnect to continue.",
  rate_limited: "Canva is rate-limiting requests right now. Try again in a moment.",
  design_unavailable: "This design is no longer available in Canva.",
  export_failed: "Canva couldn't export this design. Try again, or pick a different design.",
  export_timeout: "The export took too long. Try again in a moment.",
  api_error: "Canva couldn't complete that request. Try again in a moment.",
};

function needsReconnect(reason: CanvaApiFailureReason): boolean {
  return reason === "not_connected" || reason === "reauth_required";
}

type Step = "browse" | "preview" | "importing" | "duplicate" | "done";

export function CanvaDesignPicker({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("browse");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duplicateProductId, setDuplicateProductId] = useState<string | null>(null);

  const listFn = useServerFn(listCanvaDesignsFn);
  const previewFn = useServerFn(previewCanvaDesignFn);
  const turnIntoProductFn = useServerFn(turnCanvaDesignIntoProductFn);

  const list = useQuery({
    queryKey: ["canva-designs"],
    queryFn: () => listFn({ data: {} }),
    retry: false,
  });

  const preview = useQuery({
    queryKey: ["canva-design-preview", selectedId],
    queryFn: () => previewFn({ data: { designId: selectedId! } }),
    enabled: step === "preview" && !!selectedId,
    retry: false,
  });

  const turnIntoProduct = useMutation({
    mutationFn: () => turnIntoProductFn({ data: { designId: selectedId! } }),
    onMutate: () => setStep("importing"),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(FAILURE_MESSAGES[result.reason as CanvaApiFailureReason] ?? "Import failed.");
        setStep("preview");
        return;
      }
      if (result.duplicate) {
        setDuplicateProductId(result.productId);
        setStep("duplicate");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["mp", "products"] });
      navigate({
        to: "/dashboard/new",
        search: { id: result.productId, type: result.productTypeKey, invalidType: undefined },
      });
      onClose();
    },
    onError: () => {
      toast.error("Import failed. Try again.");
      setStep("preview");
    },
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title =
    step === "preview" || step === "importing"
      ? "Preview design"
      : step === "duplicate"
        ? "Already imported"
        : "Choose a Canva design";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="canva-picker-title"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-ink/10 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            {(step === "preview" || step === "importing") && (
              <button
                type="button"
                onClick={() => setStep("browse")}
                disabled={step === "importing"}
                aria-label="Back to designs"
                className="rounded-full p-1.5 text-mute transition hover:bg-paper disabled:opacity-50"
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
            )}
            <h3 id="canva-picker-title" className="font-display text-xl text-navy sm:text-2xl">
              {title}
            </h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-mute transition hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {step === "browse" && (
            <DesignGrid
              query={list}
              onSelect={(id) => {
                setSelectedId(id);
                setStep("preview");
              }}
              onReconnect={onClose}
            />
          )}

          {(step === "preview" || step === "importing") && (
            <PreviewPane
              query={preview}
              importing={step === "importing"}
              onTurnIntoProduct={() => turnIntoProduct.mutate()}
              onReconnect={onClose}
            />
          )}

          {step === "duplicate" && duplicateProductId && (
            <div className="py-6 text-center">
              <p className="text-sm text-mute">
                This Canva design is already linked to an AurumVault product.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-navy transition hover:border-gold/50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate({
                      to: "/dashboard/new",
                      search: { id: duplicateProductId, type: "other", invalidType: undefined },
                    });
                    onClose();
                  }}
                  className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy transition hover:bg-gold/90"
                >
                  Open existing draft
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type QueryLike<T> = {
  isLoading: boolean;
  isError: boolean;
  data: T | undefined;
};

function DesignGrid({
  query,
  onSelect,
  onReconnect,
}: {
  query: QueryLike<Awaited<ReturnType<typeof listCanvaDesignsFn>>>;
  onSelect: (id: string) => void;
  onReconnect: () => void;
}) {
  if (query.isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-mute">
        <Loader2 className="animate-spin" size={22} aria-hidden="true" />
        <p className="text-sm">Loading your Canva designs…</p>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <FailurePanel reason="api_error" onReconnect={onReconnect} />;
  }

  if (!query.data.ok) {
    return <FailurePanel reason={query.data.reason} onReconnect={onReconnect} />;
  }

  if (query.data.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-mute">
          No designs found in your Canva account yet. Create a design in Canva, then come back here.
        </p>
        <a
          href="https://www.canva.com/design/"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy underline underline-offset-4"
        >
          Open Canva <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {query.data.items.map((design) => (
        <button
          key={design.id}
          type="button"
          onClick={() => onSelect(design.id)}
          className="group flex flex-col overflow-hidden rounded-xl border border-ink/10 text-left transition hover:border-gold/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
        >
          <span className="relative aspect-square w-full bg-paper">
            {design.thumbnail ? (
              <img
                src={design.thumbnail.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[11px] text-mute">
                No preview
              </span>
            )}
          </span>
          <span className="p-2.5">
            <span className="block truncate text-xs font-semibold text-navy">{design.title}</span>
            {design.updatedAt && (
              <span className="mt-0.5 block text-[10px] text-mute">
                Edited {new Date(design.updatedAt).toLocaleDateString()}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

function PreviewPane({
  query,
  importing,
  onTurnIntoProduct,
  onReconnect,
}: {
  query: QueryLike<Awaited<ReturnType<typeof previewCanvaDesignFn>>>;
  importing: boolean;
  onTurnIntoProduct: () => void;
  onReconnect: () => void;
}) {
  if (query.isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-mute">
        <Loader2 className="animate-spin" size={22} aria-hidden="true" />
        <p className="text-sm">Loading design…</p>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <FailurePanel reason="api_error" onReconnect={onReconnect} />;
  }

  if (!query.data.ok) {
    return <FailurePanel reason={query.data.reason} onReconnect={onReconnect} />;
  }

  const { design } = query.data;

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-ink/10 bg-paper">
        {design.thumbnail ? (
          <img src={design.thumbnail.url} alt="" className="w-full object-contain" />
        ) : (
          <div className="flex aspect-square items-center justify-center text-sm text-mute">
            No preview available
          </div>
        )}
      </div>
      <div>
        <p className="font-display text-lg text-navy">{design.title}</p>
        {design.updatedAt && (
          <p className="mt-1 text-xs text-mute">
            Last edited in Canva {new Date(design.updatedAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <p className="max-w-sm text-xs text-mute">
        AurumVault will export this design and create a draft product. Nothing is published — you'll
        review title, description, category, pricing and rights before publishing.
      </p>
      <button
        type="button"
        onClick={onTurnIntoProduct}
        disabled={importing}
        aria-busy={importing}
        className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-base font-semibold text-navy shadow-sm transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {importing ? (
          <>
            <Loader2 className="animate-spin" size={18} aria-hidden="true" /> Importing…
          </>
        ) : (
          <>
            <Check size={18} aria-hidden="true" /> Turn Into Product
          </>
        )}
      </button>
    </div>
  );
}

function FailurePanel({
  reason,
  onReconnect,
}: {
  reason: CanvaApiFailureReason;
  onReconnect: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <AlertTriangle className="mx-auto text-destructive" size={22} aria-hidden="true" />
      <p className="mt-3 text-sm text-mute">{FAILURE_MESSAGES[reason]}</p>
      {needsReconnect(reason) && (
        <a
          href="/dashboard/integrations"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy underline underline-offset-4"
          onClick={onReconnect}
        >
          Go to Integrations to reconnect
        </a>
      )}
    </div>
  );
}
