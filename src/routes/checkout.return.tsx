import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Mail } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

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
  return (
    <MarketShell>
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10">
          <CheckCircle2 size={36} className="text-emerald" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold text-ink md:text-4xl">
          Payment received
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-mute">
          We've sent your download link by email. It can take a minute to arrive
          — check your inbox (and spam folder, just in case).
        </p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f9fafb] px-5 py-3 text-sm text-ink">
          <Mail size={16} className="text-gold" />
          Download links are valid for 90 days
        </div>
        {session_id && (
          <p className="mt-6 text-xs text-mute font-mono">Order ref: {session_id.slice(-12)}</p>
        )}
        <div className="mt-10">
          <Link
            to="/products"
            className="inline-flex h-12 items-center justify-center rounded-full bg-navy px-8 text-sm font-bold text-white hover:bg-navy/90"
          >
            Keep shopping
          </Link>
        </div>
      </div>
    </MarketShell>
  );
}
