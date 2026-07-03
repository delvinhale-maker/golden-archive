import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Download, Loader2, Mail, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { useCart } from "@/hooks/use-av-store";
import { getOrderTokensBySession } from "@/lib/payments.functions";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Order complete · AurumVault" }],
  }),
  component: CheckoutReturn,
});

type OrderView =
  | { status: "loading" }
  | { status: "timeout" }
  | { status: "missing_session" }
  | {
      status: "ready";
      items: { title: string; token: string | null }[];
      amountCents?: number | null;
      currency?: string | null;
    };

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const cart = useCart();
  const [view, setView] = useState<OrderView>(
    session_id ? { status: "loading" } : { status: "missing_session" },
  );

  // Clear cart on successful return.
  useEffect(() => {
    if (session_id) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id]);

  // Poll the server for the order + download tokens. The webhook may take a
  // few seconds to write the row after Stripe redirects, so we retry with
  // backoff up to ~20s before falling back to "check your email".
  useEffect(() => {
    if (!session_id) return;
    let cancelled = false;
    const delays = [800, 1200, 1600, 2000, 2500, 3000, 3500, 4000];
    let attempt = 0;

    const tick = async () => {
      try {
        const res = await getOrderTokensBySession({ data: { sessionId: session_id } });
        if (cancelled) return;
        if ("ok" in res && res.ok) {
          setView({
            status: "ready",
            items: res.items.map((i) => ({ title: i.title, token: i.token })),
            amountCents: res.amountCents,
            currency: res.currency,
          });
          return;
        }
      } catch {
        /* ignore transient errors and keep polling */
      }
      if (attempt >= delays.length) {
        if (!cancelled) setView({ status: "timeout" });
        return;
      }
      const wait = delays[attempt++];
      setTimeout(tick, wait);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [session_id]);

  return (
    <MarketShell>
      <div className="relative mx-auto max-w-2xl px-6 py-16 text-center md:py-20">
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
          🎉 Order Confirmed
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-3 text-[15px] leading-relaxed text-mute"
        >
          Thank you — your purchase is complete. Your downloads are ready below
          and a copy of the links has been emailed to you.
        </motion.p>

        {/* Downloads panel */}
        <div className="mx-auto mt-8 max-w-lg">
          {view.status === "loading" && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white px-5 py-5 text-sm text-mute shadow-sm">
              <Loader2 className="animate-spin text-gold" size={16} />
              Preparing your downloads…
            </div>
          )}

          {view.status === "ready" && (
            <ul className="space-y-3">
              {view.items.map((it, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">
                      {it.title}
                    </div>
                    <div className="text-[11px] uppercase tracking-caps text-mute">
                      Instant download · 5 uses · 90 days
                    </div>
                  </div>
                  {it.token ? (
                    <Link
                      to="/download/$token"
                      params={{ token: it.token }}
                      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gold px-4 text-xs font-bold text-navy shadow-gold-glow"
                    >
                      <Download size={14} /> Download
                    </Link>
                  ) : (
                    <span className="text-[11px] font-semibold text-mute">
                      Preparing…
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {view.status === "timeout" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              Your payment succeeded but your download links are taking longer
              than usual to appear. They've been sent to your email — check
              your inbox (and spam folder). If nothing arrives within 5
              minutes, contact support with the order reference below.
            </div>
          )}

          {view.status === "missing_session" && (
            <div className="rounded-2xl border border-line bg-white px-5 py-4 text-sm text-mute shadow-sm">
              No order reference in the URL. If you completed a purchase, your
              download links have been sent to your email.
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-xs text-mute shadow-sm"
        >
          <Mail size={14} className="text-gold" />
          Links valid for 90 days · check your email for a copy
        </motion.div>

        {session_id && (
          <p className="mt-4 font-mono text-xs text-mute">
            Order ref: {session_id.slice(-12)}
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          <Link
            to="/account"
            className="inline-flex h-11 items-center justify-center rounded-full bg-navy px-6 text-sm font-bold text-white hover:bg-navy/90"
          >
            View my orders
          </Link>
          <Link
            to="/products"
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-gold px-6 text-sm font-bold text-gold hover:bg-gold hover:text-navy"
          >
            Keep shopping
          </Link>
        </motion.div>
      </div>
    </MarketShell>
  );
}
