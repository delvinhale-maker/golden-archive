import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Mail, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { useCart } from "@/hooks/use-av-store";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Order complete · AurumVault" }],
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const cart = useCart();

  // Clear cart on successful return
  useEffect(() => {
    if (session_id) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id]);

  return (
    <MarketShell>
      <div className="relative mx-auto max-w-2xl px-6 py-20 text-center">
        {/* Sparkles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0.6],
                x: Math.cos((i / 12) * Math.PI * 2) * 120,
                y: Math.sin((i / 12) * Math.PI * 2) * 120,
              }}
              transition={{
                duration: 1.6,
                delay: 0.3 + i * 0.05,
                ease: "easeOut",
              }}
              className="absolute left-1/2 top-[100px] -ml-1 h-2 w-2 rounded-full bg-gold"
              style={{ boxShadow: "0 0 12px var(--gold)" }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gold to-[var(--gold-deep,#8a6a14)] shadow-gold-glow"
        >
          <CheckCircle2 size={42} className="text-navy" strokeWidth={2.5} />
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute -right-2 -top-2"
          >
            <Sparkles size={18} className="text-gold" />
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-7 font-display text-3xl font-bold text-ink md:text-4xl"
        >
          Welcome to the Vault
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-3 text-[15px] leading-relaxed text-mute"
        >
          Your order is confirmed. Your download links are on their way — check
          your inbox (and spam folder, just in case).
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-3 text-sm text-ink shadow-sm"
        >
          <Mail size={16} className="text-gold" />
          Download links are valid for 90 days
        </motion.div>

        {session_id && (
          <p className="mt-6 font-mono text-xs text-mute">
            Order ref: {session_id.slice(-12)}
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-10 flex justify-center gap-3"
        >
          <Link
            to="/products"
            className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-8 text-sm font-bold text-white hover:bg-navy/90"
          >
            Keep shopping
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-full border-2 border-gold px-8 text-sm font-bold text-gold hover:bg-gold hover:text-navy"
          >
            My library
          </Link>
        </motion.div>
      </div>
    </MarketShell>
  );
}
