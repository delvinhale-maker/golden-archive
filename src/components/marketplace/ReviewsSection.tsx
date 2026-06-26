import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Star, ThumbsUp, BadgeCheck, PenSquare } from "lucide-react";
import { listReviews, createReview, toggleHelpful, type ReviewSummary } from "@/lib/reviews.functions";
import { useAuth } from "@/hooks/use-auth";
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

export function ReviewsSection({ productId, fallbackRating, fallbackCount }: {
  productId: string;
  fallbackRating: number;
  fallbackCount: number;
}) {
  const list = useServerFn(listReviews);
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["reviews", productId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => list({ data: { productId } }),
    staleTime: 30_000,
  });

  const summary: ReviewSummary = data ?? {
    count: 0, average: fallbackRating,
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, reviews: [],
  };

  const displayAvg = summary.count > 0 ? summary.average : fallbackRating;
  const displayCount = summary.count > 0 ? summary.count : fallbackCount;
  const maxBar = Math.max(1, ...Object.values(summary.breakdown));

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
          Reviews
        </h2>
        {user && <WriteReviewButton productId={productId} queryKey={queryKey} />}
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[300px_1fr]">
        <div className="rounded-lg border border-line bg-white p-6">
          <div className="font-display text-5xl font-bold text-ink">
            {displayAvg.toFixed(1)}
          </div>
          <div className="mt-2"><StarRow value={displayAvg} size={16} /></div>
          <div className="mt-1 text-xs text-mute">{displayCount} reviews</div>
          <div className="mt-5 space-y-1.5">
            {([5, 4, 3, 2, 1] as const).map((s) => {
              const c = summary.breakdown[s];
              const pct = (c / maxBar) * 100;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-mute">{s}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-mute">{c}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          {summary.reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
              <p className="text-sm text-mute">No reviews yet. Be the first to share your thoughts.</p>
            </div>
          ) : (
            summary.reviews.map((r) => (
              <ReviewCard key={r.id} review={r} queryKey={queryKey} canVote={!!user} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review, queryKey, canVote }: {
  review: ReviewSummary["reviews"][number];
  queryKey: readonly unknown[];
  canVote: boolean;
}) {
  const vote = useServerFn(toggleHelpful);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const onVote = async () => {
    if (!canVote) { toast("Sign in to vote"); return; }
    setBusy(true);
    try {
      await vote({ data: { reviewId: review.id } });
      qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record vote");
    } finally { setBusy(false); }
  };
  const date = new Date(review.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
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
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
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
      <p className="mt-2 text-sm leading-relaxed text-ink">{review.body}</p>
      <button
        onClick={onVote}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-mute hover:border-gold hover:text-ink disabled:opacity-50"
      >
        <ThumbsUp size={12} /> Helpful ({review.helpful_count})
      </button>
    </div>
  );
}

function WriteReviewButton({ productId, queryKey }: { productId: string; queryKey: readonly unknown[] }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const submit = useServerFn(createReview);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => submit({ data: { productId, rating, title: title || undefined, body } }),
    onSuccess: (res) => {
      toast.success(res.verified ? "Review posted as verified purchase" : "Review posted");
      qc.invalidateQueries({ queryKey });
      setOpen(false); setTitle(""); setBody(""); setRating(5);
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
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-lg border border-line bg-white p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        {([1, 2, 3, 4, 5] as const).map((s) => (
          <button key={s} type="button" onClick={() => setRating(s)} aria-label={`${s} stars`}>
            <Star size={22} fill={s <= rating ? "var(--gold)" : "none"} stroke="var(--gold)" />
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
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-mute hover:text-ink">
          Cancel
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || body.trim().length < 4}
          className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-navy disabled:opacity-50"
        >
          {m.isPending ? "Posting…" : "Post review"}
        </button>
      </div>
    </motion.div>
  );
}
