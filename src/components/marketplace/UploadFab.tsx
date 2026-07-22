import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { BookPlus, Package, Plus, X, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PRODUCT_TYPES, PRODUCT_TYPE_ORDER, type ProductTypeKey } from "@/lib/product-types";

type View = "root" | "digital";

export function UploadFab() {
  const { isAdmin, isSeller, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("root");
  const navigate = useNavigate();

  function goToNew(type: ProductTypeKey) {
    setOpen(false);
    navigate({ to: "/dashboard/new", search: { type } as never });
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) setView("root");
  }, [open]);

  if (loading || (!isAdmin && !isSeller)) return null;
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/publish")) return null;
  // The Academy has its own admin-only Editorial Studio FAB; hide the product uploader there.
  if (pathname.startsWith("/academy") || pathname.startsWith("/admin/academy")) return null;

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Upload product"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-navy shadow-[0_8px_24px_rgba(184,134,11,0.45)] md:bottom-6 md:right-6 md:h-16 md:w-16"
      >
        <Plus size={26} strokeWidth={2.5} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 md:items-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              key={view}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl md:rounded-2xl max-h-[85vh] flex flex-col"
              role="dialog"
              aria-label="Upload product"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {view === "digital" && (
                    <button
                      type="button"
                      onClick={() => setView("root")}
                      aria-label="Back"
                      className="rounded-full p-1.5 hover:bg-muted"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <h3 className="font-display text-lg font-bold text-ink">
                    {view === "root" ? "Upload to AurumVault" : "Choose product type"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-2 hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>

              {view === "root" ? (
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => goToNew("ebook")}
                    className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 text-left transition hover:border-gold hover:bg-gold/5"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold-ink">
                      <BookPlus size={20} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold text-ink">Upload eBook</span>
                      <span className="block text-xs text-mute">KDP-style publish flow</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("digital")}
                    className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 text-left transition hover:border-gold hover:bg-gold/5"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy/10 text-navy">
                      <Package size={20} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold text-ink">Upload Digital Product</span>
                      <span className="block text-xs text-mute">Choose from 12 product types</span>
                    </span>
                  </button>
                </div>
              ) : (
                <div className="grid gap-2 overflow-y-auto pr-1 -mr-1">
                  {PRODUCT_TYPE_ORDER.map((key) => {
                    const t = PRODUCT_TYPES[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => goToNew(key)}
                        className="flex items-center gap-3 rounded-xl border border-line bg-white p-3.5 text-left transition hover:border-gold hover:bg-gold/5"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                          style={{ backgroundColor: `${t.accent}1a`, color: t.accent }}
                        >
                          {t.emoji}
                        </span>
                        <span className="flex-1 min-w-0 text-left">
                          <span className="block font-semibold text-ink">{t.label}</span>
                          <span className="block text-xs text-mute truncate">{t.tagline}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
