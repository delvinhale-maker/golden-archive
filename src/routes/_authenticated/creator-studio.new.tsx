import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { listOwnProductsForCreatorStudioFn } from "@/lib/creator-studio/product-adapter";
import { createProjectFn } from "@/lib/creator-studio/projects.functions";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type ProjectType,
  type CreatorStudioProductPreview,
} from "@/lib/creator-studio/schema";

export const Route = createFileRoute("/_authenticated/creator-studio/new")({
  component: NewProjectPage,
});

/**
 * Steps 1-2 of the wizard: pick a goal, then pick an AurumVault product or
 * skip to upload assets fresh. Creating the project (below) hands off to
 * /creator-studio/$projectId/assets for step 3 onward. A fixed two-step form
 * with a small, closed set of choices at each step.
 */
function NewProjectPage() {
  const navigate = useNavigate();
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CreatorStudioProductPreview | null>(null);
  const [skippedProduct, setSkippedProduct] = useState(false);

  const listProductsFn = useServerFn(listOwnProductsForCreatorStudioFn);
  const createFn = useServerFn(createProjectFn);

  const products = useQuery({
    queryKey: ["creator-studio", "own-products"],
    queryFn: () => listProductsFn(),
    enabled: !!projectType,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          projectType: projectType!,
          title: selectedProduct?.title ?? "Untitled project",
          sourceProductId: selectedProduct?.productId,
        },
      }),
    onSuccess: (project) => {
      navigate({ to: "/creator-studio/$projectId/assets", params: { projectId: project.id } });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't start your project"),
  });

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-2xl">
        {!projectType ? (
          <section>
            <h1 className="text-center font-display text-2xl text-navy">
              What do you want to create?
            </h1>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setProjectType(type)}
                  className="rounded-xl border border-ink/10 p-4 text-left transition hover:border-[#7A2E52]/40"
                >
                  <span className="block text-sm font-semibold text-navy">
                    {PROJECT_TYPE_LABELS[type].label}
                  </span>
                  <span className="mt-1 block text-xs text-mute">
                    {PROJECT_TYPE_LABELS[type].blurb}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <h1 className="text-center font-display text-2xl text-navy">
              {PROJECT_TYPE_LABELS[projectType].label}
            </h1>
            <p className="mt-2 text-center text-sm text-mute">
              Use an AurumVault product, or upload assets fresh.
            </p>

            <div className="mt-6 space-y-3">
              {products.isLoading ? (
                <p className="py-8 text-center text-sm text-mute">Loading your products…</p>
              ) : products.isError ? (
                <p className="py-8 text-center text-sm text-destructive">
                  Creator Studio isn't available right now.
                </p>
              ) : products.data && products.data.length > 0 ? (
                products.data.map((p) => (
                  <button
                    key={p.productId}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      setSkippedProduct(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      selectedProduct?.productId === p.productId
                        ? "border-[#7A2E52] bg-[#7A2E52]/5"
                        : "border-ink/10 hover:border-[#7A2E52]/40"
                    }`}
                  >
                    <span className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-paper">
                      {p.coverUrl && (
                        <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy">
                        {p.title}
                      </span>
                      <span className="block text-xs text-mute">
                        ${(p.priceCents / 100).toFixed(2)}
                      </span>
                    </span>
                    {selectedProduct?.productId === p.productId && (
                      <Check
                        size={18}
                        className="flex-shrink-0 text-[#7A2E52]"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-mute">
                  You don't have any products yet.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSkippedProduct(true);
                setSelectedProduct(null);
              }}
              className={`mt-3 w-full rounded-xl border p-3 text-center text-sm font-medium transition ${
                skippedProduct
                  ? "border-[#7A2E52] bg-[#7A2E52]/5 text-navy"
                  : "border-dashed border-ink/20 text-mute hover:border-[#7A2E52]/40"
              }`}
            >
              Upload another product's assets instead
            </button>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setProjectType(null)}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-navy"
              >
                Back
              </button>
              <button
                type="button"
                disabled={(!selectedProduct && !skippedProduct) || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-navy disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                ) : (
                  <>
                    Continue <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </section>
        )}
      </div>
    </PublisherShell>
  );
}
