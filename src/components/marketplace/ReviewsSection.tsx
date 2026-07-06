import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Star,
  ThumbsUp,
  BadgeCheck,
  PenSquare,
  Trash2,
  LogIn,
  ImagePlus,
  X as XIcon,
} from "lucide-react";
import {
  listReviews,
  createReview,
  toggleHelpful,
  deleteReview,
  type ReviewSort,
  type ReviewSummary,
} from "@/lib/reviews.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < Math.round(value) ? "var(--gold)" : "none"}
          stroke="var(--gold)"
        />
      ))}
    </div>
  );
}

const SORT_LABELS: Record<ReviewSort, string> = {
  helpful: "Most Helpful",
  recent: "Most Recent",
  top: "Top Rated",
};

export function ReviewsSection({
  productId,
  fallbackRating,
  fallbackCount,
}: {
  productId: string;
  fallbackRating: number;
  fallbackCount: number;
}) {
  const list = useServerFn(listReviews);
  const { user } = useAuth();
  const [sort, setSort] = useState<ReviewSort>("helpful");
  const queryKey = ["reviews", productId, sort];
  const { data } = useQuery({
    queryKey,
    queryFn: () => list({ data: { productId, sort } }),
    staleTime: 30_000,
  });

  const summary: ReviewSummary = data ?? {
    count: 0,
    average: fallbackRating,
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    reviews: [],
  };

  const displayAvg = summary.count > 0 ? summary.average : fallbackRating;
  const displayCount = summary.count > 0 ? summary.count : fallbackCount;
  const total = Math.max(1, summary.count);

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
          Customer Reviews
        </h2>
        {user ? (
          <WriteReviewButton productId={productId} queryKey={queryKey} />
        ) : (
          <Link
            to="/auth"
            search={{ redirect: `/products/${productId}` }}
            className="inline-flex items-center gap-2 rounded-full border-2 border-gold px-4 py-2 text-sm font-bold text-gold hover:bg-[var(--accent)]"
          >
            <LogIn size={14} /> Sign in to review
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[300px_1fr]">
        <div className="rounded-lg border border-line bg-white p-6">
          <div className="font-display text-5xl font-bold text-ink">
            {displayAvg.toFixed(1)}
          </div>
          <div className="mt-2">
            <StarRow value={displayAvg} size={16} />
          </div>
          <div className="mt-1 text-xs text-mute">{displayCount} reviews</div>
          <div className="mt-5 space-y-1.5">
            {([5, 4, 3, 2, 1] as const).map((s) => {
              const c = summary.breakdown[s];
              const pct = Math.round((c / total) * 100);
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-mute">{s}★</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gold transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums text-mute">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-mute">
              {summary.count} {summary.count === 1 ? "review" : "reviews"}
            </p>
            <label className="flex items-center gap-2 text-xs text-mute">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as ReviewSort)}
                className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink focus:border-gold focus:outline-none"
              >
                {(["helpful", "recent", "top"] as ReviewSort[]).map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {summary.reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
              <p className="text-sm text-mute">
                No reviews yet. Be the first to share your thoughts.
              </p>
            </div>
          ) : (
            summary.reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                queryKey={queryKey}
                canVote={!!user}
                currentUserId={user?.id ?? null}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({
  review,
  queryKey,
  canVote,
  currentUserId,
}: {
  review: ReviewSummary["reviews"][number];
  queryKey: readonly unknown[];
  canVote: boolean;
  currentUserId: string | null;
}) {
  const vote = useServerFn(toggleHelpful);
  const remove = useServerFn(deleteReview);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const onVote = async () => {
    if (!canVote) {
      toast("Sign in to vote");
      return;
    }
    setBusy(true);
    try {
      await vote({ data: { reviewId: review.id } });
      qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record vote");
    } finally {
      setBusy(false);
    }
  };
  const isAuthor = currentUserId && review.user_id === currentUserId;
  const onDelete = async () => {
    if (!isAuthor) return;
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    setBusy(true);
    try {
      await remove({ data: { reviewId: review.id } });
      toast.success("Review deleted");
      qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete review");
    } finally {
      setBusy(false);
    }
  };
  const date = new Date(review.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="flex items-center gap-3">
        <img
          src={review.reviewer_avatar || `https://i.pravatar.cc/64?u=${review.id}`}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
            {review.reviewer_name}
            {review.verified_purchase && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald/10 px-2 py-0.5 text-[10px] font-semibold text-emerald">
                <BadgeCheck size={11} /> Verified Purchase
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-mute">
            <StarRow value={review.rating} size={11} />
            <span>{date}</span>
          </div>
        </div>
      </div>
      {review.title && (
        <div className="mt-3 text-sm font-bold text-ink">{review.title}</div>
      )}
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
        {review.body}
      </p>
      {((review as any).photos?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {((review as any).photos as string[]).slice(0, 4).map((src, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setLightbox(src)}
              className="block overflow-hidden rounded-md border border-line hover:border-gold"
              aria-label="View review photo"
            >
              <img
                src={src}
                alt={`Review photo ${idx + 1}`}
                className="h-24 w-24 object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {((review as any).photos?.length ?? 0) === 0 && review.photo_url && (
        <button
          type="button"
          onClick={() => setLightbox(review.photo_url!)}
          className="mt-3 block overflow-hidden rounded-md border border-line hover:border-gold"
          aria-label="View review photo"
        >
          <img
            src={review.photo_url}
            alt="Review attachment"
            className="h-32 w-32 object-cover"
          />
        </button>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onVote}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-mute hover:border-gold hover:text-ink disabled:opacity-50"
        >
          <ThumbsUp size={12} /> Helpful ({review.helpful_count})
        </button>
        {isAuthor && (
          <button
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-mute hover:border-red-500 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <XIcon size={18} />
          </button>
          <img
            src={lightbox}
            alt="Review attachment"
            className="max-h-[85vh] max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function WriteReviewButton({
  productId,
  queryKey,
}: {
  productId: string;
  queryKey: readonly unknown[];
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const submit = useServerFn(createReview);
  const qc = useQueryClient();
  const { user } = useAuth();

  const reset = () => {
    setOpen(false);
    setTitle("");
    setBody("");
    setRating(5);
    setPhotoFiles([]);
    setPhotoPreviews([]);
  };

  const m = useMutation({
    mutationFn: async () => {
      const paths: string[] = [];
      if (photoFiles.length && user) {
        setUploading(true);
        try {
          for (const file of photoFiles) {
            const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
            const path = `${user.id}/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("review-photos")
              .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || "image/jpeg",
              });
            if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
            paths.push(path);
          }
        } finally {
          setUploading(false);
        }
      }
      return submit({
        data: {
          productId,
          rating,
          title: title || undefined,
          body,
          photoPaths: paths.length ? paths : undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(
        res.verified ? "Review posted as verified purchase" : "Review posted",
      );
      qc.invalidateQueries({ queryKey });
      reset();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to post"),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border-2 border-gold px-4 py-2 text-sm font-bold text-gold hover:bg-[var(--accent)]"
      >
        <PenSquare size={14} /> Write a review
      </button>
    );
  }

  const onPickPhotos = (files: FileList | null) => {
    if (!files) return;
    const remaining = 4 - photoFiles.length;
    const chosen = Array.from(files).slice(0, Math.max(0, remaining));
    const valid: File[] = [];
    for (const file of chosen) {
      if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
        toast.error("JPG, PNG, or WebP only");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Each photo must be under 5MB");
        continue;
      }
      valid.push(file);
    }
    if (valid.length) {
      setPhotoFiles((prev) => [...prev, ...valid]);
      setPhotoPreviews((prev) => [
        ...prev,
        ...valid.map((f) => URL.createObjectURL(f)),
      ]);
    }
  };

  const removePhoto = (i: number) => {
    setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-lg border border-line bg-white p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        {([1, 2, 3, 4, 5] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            aria-label={`${s} stars`}
          >
            <Star
              size={22}
              fill={s <= rating ? "var(--gold)" : "none"}
              stroke="var(--gold)"
            />
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Headline (optional)"
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="What did you think?"
        className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm"
      />

      <div className="mt-3 flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
        />
        {photoPreview ? (
          <div className="relative">
            <img
              src={photoPreview}
              alt="Photo preview"
              className="h-16 w-16 rounded-md border border-line object-cover"
            />
            <button
              type="button"
              onClick={() => onPickPhoto(null)}
              aria-label="Remove photo"
              className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-navy text-white"
            >
              <XIcon size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-mute hover:border-gold hover:text-ink"
          >
            <ImagePlus size={12} /> Add a photo (optional)
          </button>
        )}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={reset}
          className="rounded-full px-4 py-2 text-sm font-semibold text-mute hover:text-ink"
        >
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || uploading || body.trim().length < 4}
          className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-navy disabled:opacity-50"
        >
          {uploading
            ? "Uploading photo…"
            : m.isPending
              ? "Posting…"
              : "Post review"}
        </button>
      </div>
    </motion.div>
  );
}
