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

export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white md:hidden">
      <ul className="flex h-16 items-stretch">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.to + t.label} className="flex-1">
              <Link
                to={t.to}
                className="flex h-full w-full flex-col items-center justify-center gap-0.5"
                aria-current={active ? "page" : undefined}
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
