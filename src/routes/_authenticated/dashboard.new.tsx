import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/new")({
  component: NewProduct,
});

const CATEGORIES = [
  { v: "ebooks", label: "eBook" },
  { v: "courses", label: "Course" },
  { v: "templates", label: "Template" },
  { v: "audio", label: "Audio" },
  { v: "leadership", label: "Leadership" },
];

function NewProduct() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("ebooks");
  const [price, setPrice] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canSell, setCanSell] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("seller_applications").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCanSell(data?.status === "approved"));
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!cover || !file) {
      toast.error("Please upload both a cover image and a product file.");
      return;
    }
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!priceCents || priceCents < 100) {
      toast.error("Price must be at least $1.");
      return;
    }

    setSubmitting(true);
    try {
      const ts = Date.now();
      const coverPath = `${user.id}/${ts}-${cover.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `${user.id}/${ts}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const [coverUp, fileUp] = await Promise.all([
        supabase.storage.from("product-covers").upload(coverPath, cover, { upsert: false }),
        supabase.storage.from("product-files").upload(filePath, file, { upsert: false }),
      ]);
      if (coverUp.error) throw coverUp.error;
      if (fileUp.error) throw fileUp.error;

      const { data: signed } = await supabase.storage.from("product-covers").createSignedUrl(coverPath, 60 * 60 * 24 * 365 * 5);

      const { error } = await supabase.from("marketplace_products").insert({
        seller_id: user.id,
        title,
        description,
        category: category as "ebooks" | "courses" | "templates" | "audio" | "leadership",
        price_cents: priceCents,
        cover_url: signed?.signedUrl ?? null,
        file_path: filePath,
        file_size_bytes: file.size,
        status: "pending",
      });
      if (error) throw error;

      toast.success("Product submitted for review");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-3xl px-4 md:px-8 py-4 flex items-center gap-4">
          <Link to="/"><AVLogo /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 md:px-8 py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-navy">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-navy mt-3">New product</h1>
        <p className="text-mute mt-1">It will be reviewed by our team before going live. AurumVault keeps 9%; you keep 91%.</p>

        {canSell === false && (
          <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            You're not an approved seller yet. <Link to="/sell" className="underline font-medium">Apply to sell</Link> first.
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-5 bg-white rounded-2xl p-6 border border-ink/10">
          <Field label="Product title">
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="inp" placeholder="e.g. The Stewardship Codex" />
          </Field>
          <Field label="Description">
            <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="inp" placeholder="What's in this product? Who is it for?" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="inp">
                {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Price (USD)">
              <input required type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="inp" placeholder="29.00" />
            </Field>
          </div>
          <Field label="Cover image (JPG/PNG, square preferred)">
            <FileInput accept="image/*" file={cover} onFile={setCover} />
          </Field>
          <Field label="Product file (PDF, ZIP, audio, etc.)">
            <FileInput accept=".pdf,.zip,.epub,.mp3,.wav,.m4a,.mp4,application/*" file={file} onFile={setFile} />
          </Field>

          <button
            type="submit" disabled={submitting || canSell === false}
            className="w-full h-12 rounded-full bg-navy text-white font-semibold hover:bg-navy/90 disabled:opacity-60"
          >
            {submitting ? "Uploading…" : "Submit for review"}
          </button>
        </form>
      </main>
      <style>{`.inp{display:block;width:100%;min-height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.12);padding:10px 14px;font-size:14px;background:white;color:#0F1A33}.inp:focus{outline:none;border-color:#C9A24B;box-shadow:0 0 0 3px rgb(201 162 75 / 0.15)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-navy mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function FileInput({ accept, file, onFile }: { accept: string; file: File | null; onFile: (f: File | null) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-dashed border-ink/20 bg-paper px-4 py-3 cursor-pointer hover:border-gold">
      <Upload size={18} className="text-mute" />
      <span className="text-sm text-ink/80 truncate">
        {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : "Click to upload"}
      </span>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}
