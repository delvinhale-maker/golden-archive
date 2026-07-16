import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Grid3x3, Home, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/products", label: "Browse", icon: Grid3x3, match: (p: string) => p.startsWith("/products") },
  { to: "/academy", label: "Academy", icon: GraduationCap, match: (p: string) => p.startsWith("/academy") },
  { to: "/library", label: "Library", icon: BookOpen, match: (p: string) => p.startsWith("/library") },
  { to: "/account", label: "Account", icon: User, match: (p: string) => p.startsWith("/account") },
] as const;

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
          return (
            <li key={t.to + t.label} className="relative flex-1">
              <Link
                to={t.to}
                data-nav-tab
                data-active={active ? "true" : "false"}
                className="flex h-full w-full flex-col items-center justify-center gap-0.5"
                aria-current={active ? "page" : undefined}
              >
                <motion.span
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                >
                  <Icon size={20} />
                </motion.span>
                <span className="text-[10px] font-medium">{t.label}</span>
              </Link>
              {active && (
                <motion.span
                  layoutId="mobile-tab-underline"
                  data-nav-underline
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-x-4 bottom-0 h-0.5 rounded-full"
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
