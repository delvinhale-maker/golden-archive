import { useEffect, useState } from "react";
import { useNavigate, useRouterState, useParams } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  PenSquare,
  Pencil,
  Image as ImageIcon,
  Save,
  Rocket,
  CalendarClock,
  Eye,
  Search,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Editorial Studio: admin-only floating action button that appears only on
 * Academy routes. Provides quick access to article creation, editing, publish,
 * schedule, preview, SEO, and media controls.
 */
export function EditorialStudioFab() {
  const { user, isAdmin, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useParams({ strict: false }) as { slug?: string; id?: string };
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isAcademy = pathname.startsWith("/academy") || pathname.startsWith("/admin/academy");
  const currentSlug = pathname.startsWith("/academy/article/") ? params.slug : undefined;
  const currentEditingId = pathname.startsWith("/admin/academy/") ? params.id : undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (loading || !isAdmin || !isAcademy) return null;

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  async function createNewArticle() {
    const title = window.prompt("New article title");
    if (!title || !title.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("academy_articles")
      .insert({
        slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
        title: title.trim(),
        category: "financial-freedom",
        author_id: user?.id ?? null,
        author_name: "AurumVault Editorial",
        body: `# ${title.trim()}\n\nStart writing your article here...`,
        status: "draft",
      })
      .select("id")
      .maybeSingle();
    setBusy(false);
    if (error || !data?.id) {
      toast.error(error?.message ?? "Could not create article");
      return;
    }
    setOpen(false);
    navigate({ to: "/admin/academy/$id", params: { id: data.id } });
  }

  async function findEditingId(): Promise<string | null> {
    if (currentEditingId) return currentEditingId;
    if (currentSlug) {
      const { data } = await supabase
        .from("academy_articles")
        .select("id")
        .eq("slug", currentSlug)
        .maybeSingle();
      return (data?.id as string | undefined) ?? null;
    }
    return null;
  }

  async function jumpToEditor(hash: string) {
    const id = await findEditingId();
    if (!id) {
      setOpen(false);
      navigate({ to: "/admin/academy" });
      return;
    }
    setOpen(false);
    navigate({ to: "/admin/academy/$id", params: { id }, hash });
  }

  const items: Array<{
    key: string;
    label: string;
    hint: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [
    {
      key: "new",
      label: "New article",
      hint: "Start a fresh draft",
      icon: <PenSquare size={20} />,
      onClick: () => void createNewArticle(),
    },
    {
      key: "edit",
      label: "Edit articles",
      hint: "Browse, search, duplicate, archive",
      icon: <Pencil size={20} />,
      onClick: () => {
        setOpen(false);
        navigate({ to: "/admin/academy" });
      },
    },
    {
      key: "cover",
      label: "Upload featured image",
      hint: "Replace or set the cover",
      icon: <ImageIcon size={20} />,
      onClick: () => void jumpToEditor("cover"),
    },
    {
      key: "draft",
      label: "Save draft",
      hint: "Persist current changes",
      icon: <Save size={20} />,
      onClick: () => void jumpToEditor("body"),
    },
    {
      key: "publish",
      label: "Publish",
      hint: "Preflight and go live",
      icon: <Rocket size={20} />,
      onClick: () => void jumpToEditor("publish"),
    },
    {
      key: "schedule",
      label: "Schedule publication",
      hint: "Pick a date and time",
      icon: <CalendarClock size={20} />,
      onClick: () => void jumpToEditor("schedule"),
    },
    {
      key: "preview",
      label: "Preview",
      hint: "Open reader view",
      icon: <Eye size={20} />,
      onClick: async () => {
        if (currentSlug) {
          setOpen(false);
          navigate({ to: "/academy/article/$slug", params: { slug: currentSlug } });
          return;
        }
        const id = await findEditingId();
        if (!id) {
          setOpen(false);
          navigate({ to: "/admin/academy" });
          return;
        }
        const { data } = await supabase
          .from("academy_articles")
          .select("slug")
          .eq("id", id)
          .maybeSingle();
        setOpen(false);
        if (data?.slug) navigate({ to: "/academy/article/$slug", params: { slug: data.slug } });
      },
    },
    {
      key: "seo",
      label: "SEO settings",
      hint: "Meta, OG, schema, robots",
      icon: <Search size={20} />,
      onClick: () => void jumpToEditor("seo"),
    },
  ];

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Editorial Studio"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-navy shadow-[0_8px_24px_rgba(184,134,11,0.45)] md:bottom-6 md:right-6 md:h-16 md:w-16"
      >
        {busy ? <Sparkles size={22} className="animate-pulse" /> : <Plus size={26} strokeWidth={2.5} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-navy/70 backdrop-blur-md md:items-center"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-label="Editorial Studio menu"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-[#FBF6EA] p-5 shadow-[0_-20px_60px_rgba(15,30,53,0.4)] md:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B8860B]">
                    AurumVault
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-navy">Editorial Studio</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-2 text-navy/70 hover:bg-navy/5"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {items.map((it, i) => (
                  <motion.button
                    key={it.key}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * i }}
                    onClick={it.onClick}
                    disabled={busy}
                    className="group flex flex-col gap-1 rounded-2xl border border-navy/10 bg-white/80 p-3 text-left transition hover:-translate-y-0.5 hover:border-[#B8860B] hover:shadow-md"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#B8860B]/15 text-[#B8860B] transition group-hover:bg-[#B8860B] group-hover:text-white">
                      {it.icon}
                    </span>
                    <span className="text-sm font-semibold text-navy">{it.label}</span>
                    <span className="text-[11px] leading-snug text-navy/60">{it.hint}</span>
                  </motion.button>
                ))}
              </div>

              <p className="mt-4 text-center text-[11px] text-navy/50">
                Admin-only • Not visible to readers
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
