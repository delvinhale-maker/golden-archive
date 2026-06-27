import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { BookPlus, Package, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function UploadFab() {
  const { isAdmin, isSeller, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (loading || (!isAdmin && !isSeller)) return null;

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
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl md:rounded-2xl"
              role="dialog"
              aria-label="Upload product"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-ink">
                  Upload to AurumVault
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-2 hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-3">
                <Link
                  to="/dashboard/new"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-gold hover:bg-gold/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold">
                    <BookPlus size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-ink">Upload eBook</span>
                    <span className="block text-xs text-mute">
                      KDP-style publish flow
                    </span>
                  </span>
                </Link>
                <Link
                  to="/dashboard/new"
                  search={{ type: "other" } as never}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-gold hover:bg-gold/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy/10 text-navy">
                    <Package size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-ink">
                      Upload Digital Product
                    </span>
                    <span className="block text-xs text-mute">
                      Course, template, audio, prompt pack, or other
                    </span>
                  </span>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
