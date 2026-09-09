import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { MarketHeader } from "./MarketHeader";
import { MarketFooter } from "./MarketFooter";
import { MobileTabBar } from "./MobileTabBar";
import { CartDrawer } from "./CartDrawer";
import { UploadFab } from "./UploadFab";
import { EditorialStudioFab } from "./EditorialStudioFab";
import { AbandonedCartTracker } from "./AbandonedCartTracker";

const HAS_SUPABASE_CLIENT_CONFIG = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export function MarketShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-ink">
      {HAS_SUPABASE_CLIENT_CONFIG ? <MarketHeader /> : <StaticMarketHeader />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pt-[var(--av-header-h,108px)]"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <MarketFooter />
      <MobileTabBar />
      <CartDrawer />
      <UploadFab />
      <EditorialStudioFab />
      <AbandonedCartTracker />
    </div>
  );
}

/**
 * Public fail-soft navigation for the rare case where client Supabase runtime
 * configuration is unavailable. Normal production renders MarketHeader. This
 * fallback keeps public trust/marketing content navigable instead of allowing
 * optional auth/catalog enhancements to trigger the root error boundary.
 */
function StaticMarketHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-[108px] bg-navy text-white">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link to="/" className="font-display text-xl font-semibold tracking-wide text-white">
          AurumVault
        </Link>
        <nav aria-label="Storefront" className="flex items-center gap-3 text-xs font-semibold sm:gap-5 sm:text-sm">
          <Link to="/products" className="hover:text-gold">Browse</Link>
          <Link to="/academy" className="hover:text-gold">Academy</Link>
          <Link to="/sell" className="hover:text-gold">Sell</Link>
          <Link to="/auth" className="hover:text-gold">Sign in</Link>
        </nav>
      </div>
      <nav
        aria-label="Professional resources"
        className="flex h-10 items-center gap-5 overflow-x-auto border-t border-white/10 px-4 text-xs text-white/80 md:justify-center md:px-8"
      >
        <Link to="/business-systems" className="whitespace-nowrap hover:text-gold">
          Business Systems
        </Link>
        <Link to="/creator-business-tools" className="whitespace-nowrap hover:text-gold">
          Creator Business Tools
        </Link>
        <Link
          to="/collections/film-tv-creator-production"
          className="whitespace-nowrap hover:text-gold"
        >
          Film, TV & Creator Production
        </Link>
        <Link to="/about/trust" className="whitespace-nowrap hover:text-gold">
          Trust Center
        </Link>
      </nav>
    </header>
  );
}
