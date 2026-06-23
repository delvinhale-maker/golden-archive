import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Grid3x3, Heart, Home, Search, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/products", label: "Browse", icon: Grid3x3 },
  { to: "/products", label: "Search", icon: Search, search: { focus: 1 } },
  { to: "/products", label: "Wishlist", icon: Heart, search: { wishlist: 1 } },
  { to: "/", label: "Account", icon: User },
] as const;

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white md:hidden">
      <ul className="flex h-16 items-stretch">
        {TABS.map((t, i) => {
          const active =
            (t.to === "/" && pathname === "/" && t.label === "Home") ||
            (t.to === "/products" && pathname.startsWith("/products") && t.label === "Browse");
          const Icon = t.icon;
          return (
            <li key={i} className="flex-1">
              <Link
                to={t.to as never}
                className="flex h-full w-full flex-col items-center justify-center gap-0.5"
              >
                <motion.span
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className={active ? "text-gold" : "text-mute"}
                >
                  <Icon size={20} />
                </motion.span>
                <span
                  className={`text-[10px] font-medium ${active ? "text-gold" : "text-mute"}`}
                >
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
