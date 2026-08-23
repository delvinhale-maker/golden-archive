import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Upload, Plus, Trash2, Package, Sparkles, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreatorStorefrontShare } from "@/components/marketplace/CreatorStorefrontShare";
import {
  getMyStorefrontSettings,
  saveMyStorefrontProfile,
  saveMyStorefrontSettings,
} from "@/lib/storefront.functions";
import {
  ACCENT_CLASSES,
  MAX_FEATURED_PRODUCTS,
  STOREFRONT_ACCENTS,
  type StorefrontAccent,
} from "@/lib/storefront";

export const Route = createFileRoute("/_authenticated/dashboard/storefront")({
  component: StorefrontManager,
});

type App = {
  id: string;
  user_id: string;
  brand_slug: string | null;
  cover_url: string | null;
  extended_bio: string | null;
  story: string | null;
  credentials: string[] | null;
  featured_media_url: string | null;
  status: string;
};
type Product = { id: string; title: string; cover_url: string | null; price_cents: number };
type Bundle = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  published: boolean;
  items: string[];
};

function StorefrontManager() {
  const { user } = useAuth();
  const saveProfileFn = useServerFn(saveMyStorefrontProfile);
  const [app, setApp] = useState<App | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // form
  const [extendedBio, setExtendedBio] = useState("");
  const [story, setStory] = useState("");
  const [credentialsText, setCredentialsText] = useState("");
  const [featuredMediaUrl, setFeaturedMediaUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: a } = await (supabase.from("seller_applications") as any)
        .select(
          "id, user_id, brand_slug, cover_url, extended_bio, story, credentials, featured_media_url, status",
        )
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      setApp(a);
      if (a) {
        setExtendedBio(a.extended_bio ?? "");
        setStory(a.story ?? "");
        setCredentialsText((a.credentials ?? []).join("\n"));
        setFeaturedMediaUrl(a.featured_media_url ?? "");
      }
      const { data: p } = await supabase
        .from("marketplace_products")
        .select("id, title, cover_url, price_cents")
        .eq("seller_id", user.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      setProducts((p ?? []) as Product[]);
      const { data: b } = await (supabase.from("creator_bundles" as any) as any)
        .select(
          "id, title, description, price_cents, compare_at_price_cents, published, creator_bundle_items(product_id)",
        )
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });
      setBundles(
        ((b ?? []) as any[]).map((x) => ({
          id: x.id,
          title: x.title,
          description: x.description,
          price_cents: x.price_cents,
          compare_at_price_cents: x.compare_at_price_cents,
          published: x.published,
          items: (x.creator_bundle_items ?? []).map((i: any) => i.product_id),
        })),
      );
      setLoading(false);
    })();
  }, [user]);

  const uploadCover = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("creator-covers")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("creator-covers").getPublicUrl(path);
      await saveProfileFn({ data: { coverUrl: pub.publicUrl } });
      setApp({ ...app!, cover_url: pub.publicUrl });
      toast.success("Cover updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!app) return;
    setSaving(true);
    const creds = credentialsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await saveProfileFn({
        data: {
          extendedBio: extendedBio || null,
          story: story || null,
          credentials: creds.length ? creds : null,
          featuredMediaUrl: featuredMediaUrl || null,
        },
      });
      toast.success("Storefront updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save storefront");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PublisherShell accent={ACCENTS.bookshelf}>
        <p className="text-mute">Loading…</p>
      </PublisherShell>
    );
  }

  if (!app) {
    return (
      <PublisherShell accent={ACCENTS.bookshelf}>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-mute hover:text-navy"
        >
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="mt-6 rounded-2xl bg-white border border-ink/10 p-8 text-center">
          <p className="font-display text-2xl text-navy">Storefront not available yet</p>
          <p className="text-mute mt-2">
            Get approved as a creator first, then customize your public storefront here.
          </p>
          <Link
            to="/sell"
            className="inline-flex mt-4 rounded-full bg-gold text-navy font-semibold px-5 py-2.5"
          >
            Apply to sell
          </Link>
        </div>
      </PublisherShell>
    );
  }

  return (
    <PublisherShell accent={ACCENTS.bookshelf}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy">Storefront</h1>
          <p className="text-mute text-sm mt-1">Customize your public creator page and bundles.</p>
        </div>
        {app.brand_slug && (
          <Link
            to="/store/$slug"
            params={{ slug: app.brand_slug }}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-navy text-white hover:bg-navy/90"
          >
            View storefront <ExternalLink size={13} />
          </Link>
        )}
        <Link
          to="/dashboard/analytics"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm text-navy hover:bg-paper"
        >
          <BarChart3 size={13} /> Analytics
        </Link>
      </div>

      {/* Cover */}
      <section className="mt-6 rounded-2xl bg-white border border-ink/10 overflow-hidden">
        <div
          className="h-40 md:h-56 bg-gradient-to-br from-navy to-[#22335A] bg-cover bg-center"
          style={app.cover_url ? { backgroundImage: `url(${app.cover_url})` } : undefined}
        />
        <div className="p-4 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <p className="font-medium text-navy">Cover banner</p>
            <p className="text-xs text-mute">Recommended 1500×400. JPG or PNG, up to 5MB.</p>
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm cursor-pointer hover:bg-navy/90">
            <Upload size={14} /> {uploading ? "Uploading…" : "Upload cover"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCover(f);
              }}
            />
          </label>
        </div>
      </section>

      {/* About form */}
      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-5 space-y-4">
        <h2 className="font-display text-xl text-navy">About</h2>
        <Field label="Extended bio">
          <textarea
            value={extendedBio}
            onChange={(e) => setExtendedBio(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            placeholder="Tell buyers who you are and what you make."
          />
        </Field>
        <Field label="Story & mission">
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            placeholder="Why do you do this? What's your mission?"
          />
        </Field>
        <Field label="Credentials & experience (one per line)">
          <textarea
            value={credentialsText}
            onChange={(e) => setCredentialsText(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            placeholder="10+ years designing brand systems&#10;Featured in Fast Company"
          />
        </Field>
        <Field label="Featured media URL (YouTube video or image)">
          <input
            value={featuredMediaUrl}
            onChange={(e) => setFeaturedMediaUrl(e.target.value)}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            placeholder="https://youtu.be/…"
          />
        </Field>
        <div className="flex justify-end">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-gold text-navy font-medium text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      {/* Identity & merchandising */}
      <StorefrontMerchandising products={products} />

      {/* Share & QR */}
      {app.brand_slug && (
        <CreatorStorefrontShare
          path={`/creator/${app.brand_slug}`}
          brandName={app.brand_slug}
          creatorUserId={user!.id}
        />
      )}

      {/* Bundles */}
      <BundleManager
        sellerId={user!.id}
        products={products}
        bundles={bundles}
        setBundles={setBundles}
      />
    </PublisherShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function BundleManager({
  sellerId,
  products,
  bundles,
  setBundles,
}: {
  sellerId: string;
  products: Product[];
  bundles: Bundle[];
  setBundles: (b: Bundle[]) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const originalTotal = Array.from(selected).reduce((s, id) => {
    const p = products.find((x) => x.id === id);
    return s + (p?.price_cents ?? 0);
  }, 0);

  const create = async () => {
    if (!title.trim() || !priceDollars || selected.size === 0) {
      return toast.error("Add a title, price, and at least one product");
    }
    setSaving(true);
    const cents = Math.round(Number(priceDollars) * 100);
    const { data: b, error } = await (supabase.from("creator_bundles" as any) as any)
      .insert({
        seller_id: sellerId,
        title: title.trim(),
        description: description.trim() || null,
        price_cents: cents,
        compare_at_price_cents: originalTotal || null,
      })
      .select("id")
      .single();
    if (error || !b) {
      setSaving(false);
      return toast.error(error?.message || "Failed to create");
    }
    const items = Array.from(selected).map((product_id, i) => ({
      bundle_id: b.id,
      product_id,
      position: i,
    }));
    const { error: iErr } = await (supabase.from("creator_bundle_items" as any) as any).insert(items);
    setSaving(false);
    if (iErr) return toast.error(iErr.message);
    setBundles([
      {
        id: b.id,
        title: title.trim(),
        description: description.trim() || null,
        price_cents: cents,
        compare_at_price_cents: originalTotal || null,
        published: true,
        items: Array.from(selected),
      },
      ...bundles,
    ]);
    setTitle("");
    setDescription("");
    setPriceDollars("");
    setSelected(new Set());
    setCreating(false);
    toast.success("Bundle created");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this bundle?")) return;
    const { error } = await (supabase.from("creator_bundles" as any) as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    setBundles(bundles.filter((b) => b.id !== id));
  };

  const togglePublished = async (b: Bundle) => {
    const { error } = await (supabase.from("creator_bundles" as any) as any)
      .update({ published: !b.published })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    setBundles(bundles.map((x) => (x.id === b.id ? { ...x, published: !b.published } : x)));
  };

  return (
    <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-navy inline-flex items-center gap-2">
          <Package size={18} /> Bundle deals
        </h2>
        <button
          onClick={() => setCreating((c) => !c)}
          className="text-sm px-3 py-1.5 rounded-lg bg-navy text-white inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> New bundle
        </button>
      </div>

      {creating && (
        <div className="mt-4 rounded-xl bg-paper border border-ink/10 p-4 space-y-3">
          <Field label="Bundle title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              placeholder="Starter Pack"
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              placeholder="Best value for new subscribers"
            />
          </Field>
          <Field label="Bundle price (USD)">
            <input
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              placeholder="49.00"
            />
          </Field>
          <div>
            <p className="text-sm font-medium text-navy mb-2">Included products</p>
            <div className="max-h-56 overflow-y-auto divide-y divide-ink/5 border border-ink/10 rounded-lg">
              {products.length === 0 && (
                <p className="p-3 text-sm text-mute">No approved products yet.</p>
              )}
              {products.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2.5 hover:bg-paper cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <div
                    className="w-9 h-9 rounded bg-navy/5 bg-cover bg-center"
                    style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}
                  />
                  <span className="flex-1 text-sm text-navy line-clamp-1">{p.title}</span>
                  <span className="text-xs text-mute">${(p.price_cents / 100).toFixed(2)}</span>
                </label>
              ))}
            </div>
            {selected.size > 0 && (
              <p className="text-xs text-mute mt-2">
                Original total: ${(originalTotal / 100).toFixed(2)}
                {priceDollars &&
                  Number(priceDollars) * 100 < originalTotal &&
                  ` · Savings: $${((originalTotal - Number(priceDollars) * 100) / 100).toFixed(2)}`}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-2 rounded-lg text-sm text-mute"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gold text-navy font-medium text-sm disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create bundle"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {bundles.length === 0 && !creating && (
          <p className="text-sm text-mute">No bundles yet. Package your best sellers into a deal.</p>
        )}
        {bundles.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-ink/10 bg-paper"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-navy">{b.title}</p>
              <p className="text-xs text-mute">
                {b.items.length} products · ${(b.price_cents / 100).toFixed(2)}
                {b.compare_at_price_cents ? ` (was $${(b.compare_at_price_cents / 100).toFixed(2)})` : ""}
              </p>
            </div>
            <button
              onClick={() => togglePublished(b)}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                b.published
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-white border-ink/10 text-mute"
              }`}
            >
              {b.published ? "Published" : "Draft"}
            </button>
            <button
              onClick={() => remove(b.id)}
              className="p-2 text-mute hover:text-red-600"
              aria-label="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Storefront identity + merchandising: headline, accent, and creator-selected
 * featured products. Server validates ownership of every featured product id.
 */
function StorefrontMerchandising({ products }: { products: Product[] }) {
  const fetchSettings = useServerFn(getMyStorefrontSettings);
  const saveSettings = useServerFn(saveMyStorefrontSettings);

  const [headline, setHeadline] = useState<string | null>(null);
  const [accent, setAccent] = useState<StorefrontAccent>("gold");
  const [featured, setFeatured] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["my-storefront-settings"],
    queryFn: async () => {
      const s = await fetchSettings({});
      setHeadline(s.headline ?? "");
      setAccent(s.accent);
      setFeatured(s.featuredProductIds);
      return s;
    },
  });

  const toggleFeatured = (id: string) => {
    setFeatured((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_FEATURED_PRODUCTS) {
        toast.error(`You can feature up to ${MAX_FEATURED_PRODUCTS} products`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveSettings({
        data: {
          headline: headline?.trim() ? headline.trim() : null,
          accent,
          featuredProductIds: featured,
        },
      });
      setFeatured(saved.featuredProductIds);
      toast.success("Storefront branding saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save branding");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 space-y-4">
      <h2 className="font-display text-xl text-navy inline-flex items-center gap-2">
        <Sparkles size={18} /> Identity & creator picks
      </h2>

      {isLoading ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : (
        <>
          <Field label="Storefront headline (shown under your name)">
            <input
              value={headline ?? ""}
              maxLength={90}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
              placeholder="Systems and templates for faith-driven founders"
            />
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-navy">Accent colour</p>
            <div className="flex flex-wrap gap-2">
              {STOREFRONT_ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAccent(a)}
                  aria-pressed={accent === a}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    accent === a
                      ? `${ACCENT_CLASSES[a].border} bg-paper text-navy`
                      : "border-ink/15 text-mute"
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full ${ACCENT_CLASSES[a].bg}`} />
                  {ACCENT_CLASSES[a].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-navy">
              Featured products{" "}
              <span className="font-normal text-mute">
                ({featured.length}/{MAX_FEATURED_PRODUCTS})
              </span>
            </p>
            <div className="max-h-56 divide-y divide-ink/5 overflow-y-auto rounded-lg border border-ink/10">
              {products.length === 0 && (
                <p className="p-3 text-sm text-mute">No live products yet.</p>
              )}
              {products.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 p-2.5 hover:bg-paper"
                >
                  <input
                    type="checkbox"
                    checked={featured.includes(p.id)}
                    onChange={() => toggleFeatured(p.id)}
                  />
                  <div
                    className="h-9 w-9 rounded bg-navy/5 bg-cover bg-center"
                    style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}
                  />
                  <span className="line-clamp-1 flex-1 text-sm text-navy">{p.title}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-navy disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save branding"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
