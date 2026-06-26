import { type ReactNode } from "react";
import { MarketHeader } from "./MarketHeader";
import { MarketFooter } from "./MarketFooter";
import { MobileTabBar } from "./MobileTabBar";
import { CartDrawer } from "./CartDrawer";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { motion } from "framer-motion";

export function MarketShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-ink">
      <PaymentTestModeBanner />
      <MarketHeader />
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pt-[108px] md:pt-[112px]"
      >
        {children}
      </motion.main>
      <MarketFooter />
      <MobileTabBar />
      <CartDrawer />
    </div>
  );
}
