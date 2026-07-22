import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { MarketHeader } from "./MarketHeader";
import { MarketFooter } from "./MarketFooter";
import { MobileTabBar } from "./MobileTabBar";
import { CartDrawer } from "./CartDrawer";
import { UploadFab } from "./UploadFab";
import { EditorialStudioFab } from "./EditorialStudioFab";
import { AbandonedCartTracker } from "./AbandonedCartTracker";

export function MarketShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-ink">
      <MarketHeader />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pt-[108px] md:pt-[112px]"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <MarketFooter />
      <MobileTabBar />
      <CartDrawer />
      <UploadFab />
      <AbandonedCartTracker />
    </div>
  );
}

