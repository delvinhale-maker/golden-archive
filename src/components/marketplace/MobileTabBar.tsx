import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Grid3x3, Heart, Home, Search, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/products", label: "Browse", icon: Grid3x3, match: (p: string) => p.startsWith("/products") },
  { to: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
  { to: "/wishlist", label: "Wishlist", icon: Heart, match: (p: string) => p.startsWith("/wishlist") },
  { to: "/account", label: "Account", icon: User, match: (p: string) => p.startsWith("/account") },
] as const;

const INACTIVE = "#6B7280";

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/5 md:hidden"
      style={{ backgroundColor: "#0F1E35" }}
    >
      <ul className="relative flex h-16 items-stretch">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          const color = active ? "var(--accent-color)" : INACTIVE;
          return (
            <li key={t.to + t.label} className="relative flex-1">
              <Link
                to={t.to}
                className="flex h-full w-full flex-col items-center justify-center gap-0.5"
                aria-current={active ? "page" : undefined}
              >
                <motion.span
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  style={{ color, transition: "color 300ms ease" }}
                >
                  <Icon size={20} />
                </motion.span>
                <span
                  className="text-[10px] font-medium"
                  style={{ color, transition: "color 300ms ease" }}
                >
                  {t.label}
                </span>
              </Link>
              {active && (
                <motion.span
                  layoutId="mobile-tab-underline"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-x-4 bottom-0 h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--accent-color)" }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
