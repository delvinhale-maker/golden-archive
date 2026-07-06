import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Rocket } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getPreorderConfig,
  updatePreorderConfig,
  releaseNow,
} from "@/lib/preorders.functions";

export const Route = createFileRoute("/_authenticated/dashboard/preorder/$id")({
  component: PreorderPage,
});

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PreorderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [isPreorder, setIsPreorder] = useState(false);
  const [releaseDate, setReleaseDate] = useState("");
  const [note, setNote] = useState("");
  const [releasedAt, setReleasedAt] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: prod } = await supabase
          .from("marketplace_products")
          .select("title,seller_id")
          .eq("id", id)
          .maybeSingle();
        if (cancelled) return;
        if (!prod || prod.seller_id !== user.id) {
          toast.error("You don't have access to this product");
          navigate({ to: "/dashboard" });
          return;
        }
        setTitle(prod.title);
        const cfg = await getPreorderConfig({ data: { productId: id } });
        if (cancelled) return;
        setIsPreorder(cfg.isPreorder);
        setReleaseDate(toLocalInputValue(cfg.releaseDate));
        setNote(cfg.preorderNote ?? "");
        setReleasedAt(cfg.releasedAt);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, authLoading, navigate]);

  async function handleSave() {
    if (isPreorder && !releaseDate) {
      toast.error("Pick a release date");
      return;
    }
    setSaving(true);
    try {
      await updatePreorderConfig({
        data: {
          productId: id,
          isPreorder,
          releaseDate: isPreorder ? new Date(releaseDate).toISOString() : null,
          preorderNote: note.trim() || null,
        },
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleReleaseNow() {
    if (!confirm("Release this product now and email all pre-order buyers?")) return;
    setReleasing(true);
    try {
      const res = await releaseNow({ data: { productId: id } });
      if (res.alreadyReleased) {
        toast.info("Already released");
      } else {
        toast.success("Released — download emails queued");
      }
      setReleasedAt(new Date().toISOString());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Release failed");
    } finally {
      setReleasing(false);
    }
  }

  if (loading) {
    return (
      <PublisherShell accent={ACCENTS.publishStep2}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Loader2 className="mx-auto animate-spin text-gold" />
        </div>
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={ACCENTS.publishStep2}>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-mute hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to Bookshelf
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
          Pre-order · {title}
        </h1>
        <p className="mt-2 text-sm text-mute">
          Sell before your files are ready. On release day, buyers get automatic download emails.
        </p>

        <div className="mt-8 space-y-5 rounded-xl border border-line bg-white p-6">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-gold"
              checked={isPreorder}
              onChange={(e) => setIsPreorder(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-bold text-ink">Enable pre-order</span>
              <span className="block text-xs text-mute">
                Buyers see a pre-order badge and won't be able to download until release day.
              </span>
            </span>
          </label>

          {isPreorder && (
            <>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-caps text-mute">
                  Release date
                </span>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-gold"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-caps text-mute">
                  Pre-order note (optional)
                </span>
                <input
                  type="text"
                  maxLength={300}
                  placeholder="e.g. Ships March 15 — early buyers get bonus chapter"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-gold"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              {releasedAt && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Released on {new Date(releasedAt).toLocaleString()}
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gold px-6 text-sm font-bold text-navy disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
            {isPreorder && !releasedAt && (
              <button
                type="button"
                onClick={handleReleaseNow}
                disabled={releasing}
                className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-navy px-5 text-sm font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-60"
              >
                {releasing ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                Release now
              </button>
            )}
          </div>
        </div>
      </div>
    </PublisherShell>
  );
}
