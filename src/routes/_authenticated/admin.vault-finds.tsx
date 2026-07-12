import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Loader2, Upload } from "lucide-react";

const BUCKET = "vault-finds";

async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const Route = createFileRoute("/_authenticated/admin/vault-finds")({
  component: VaultFindsAdminPage,
});

type Row = {
  id: string;
  headline: string;
  subtext: string;
  image_url: string | null;
  affiliate_link: string;
  accent_color: string;
  active: boolean;
  sort_order: number;
  created_at: string;
};

const ACCENTS = ["emerald", "burgundy", "amber", "dusty", "cream"] as const;

function VaultFindsAdminPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [accent, setAccent] = useState<(typeof ACCENTS)[number]>("emerald");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    let alive = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const ok = data?.role === "admin";
        setIsAdmin(ok);
        setCheckingAdmin(false);
        if (!ok) navigate({ to: "/dashboard" });
      });
    return () => {
      alive = false;
    };
  }, [user, loading, navigate]);

  const load = async () => {
    const { data, error } = await supabase
      .from("vault_finds_products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim() || !subtext.trim() || !affiliateLink.trim()) {
      toast.error("Headline, subtext, and affiliate link are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("vault_finds_products").insert({
      headline: headline.trim(),
      subtext: subtext.trim(),
      image_url: imageUrl.trim() || null,
      affiliate_link: affiliateLink.trim(),
      accent_color: accent,
      active,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vault Find added");
    setHeadline("");
    setSubtext("");
    setImageUrl("");
    setAffiliateLink("");
    setAccent("emerald");
    setActive(true);
    void load();
  };

  const toggle = async (row: Row) => {
    const { error } = await supabase
      .from("vault_finds_products")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this Vault Find?")) return;
    const { error } = await supabase.from("vault_finds_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  if (loading || checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <Loader2 className="h-6 w-6 animate-spin text-navy" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
        <Link
          to="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-gold-ink"
        >
          <ArrowLeft size={14} /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl text-navy">Vault Finds</h1>
        <p className="mt-1 text-sm text-ink/70">
          Manage the affiliate product pool shown on the homepage. Cards rotate weekly.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm"
        >
          <h2 className="font-display text-lg text-navy">Add a product</h2>
          <div>
            <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
              Headline
            </label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="See Everything. Miss Nothing."
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
              Subtext (one line)
            </label>
            <input
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
              maxLength={160}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="AI-powered smart glasses with built-in camera…"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
              Image URL (optional)
            </label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              type="url"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
              Affiliate link
            </label>
            <input
              value={affiliateLink}
              onChange={(e) => setAffiliateLink(e.target.value)}
              type="url"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="https://amzn.to/…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-caps text-ink/70">
                Accent color
              </label>
              <select
                value={accent}
                onChange={(e) => setAccent(e.target.value as (typeof ACCENTS)[number])}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              >
                {ACCENTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Active
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center rounded-full bg-navy px-6 text-sm font-bold text-white hover:bg-navy/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add product"}
          </button>
        </form>

        <div className="mt-10">
          <h2 className="font-display text-lg text-navy">
            All products <span className="text-sm text-ink/60">({rows.length})</span>
          </h2>
          <ul className="mt-4 space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-line bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: {
                          emerald: "#1B7A5C",
                          burgundy: "#7A2E3E",
                          amber: "#C9832E",
                          dusty: "#3E5C76",
                          cream: "#F4F1E8",
                        }[r.accent_color] ?? "#999",
                      }}
                    />
                    <div className="truncate font-semibold text-navy">{r.headline}</div>
                    {!r.active && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink/60">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-ink/60">{r.subtext}</div>
                  <a
                    href={r.affiliate_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-xs text-gold-ink hover:underline"
                  >
                    {r.affiliate_link}
                  </a>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggle(r)}
                    className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-navy"
                  >
                    {r.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    className="rounded-full border border-line p-2 text-ink/60 hover:border-red-500 hover:text-red-600"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink/60">
                No products yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
