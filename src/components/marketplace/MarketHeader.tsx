import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AVLogo } from "./AVLogo";
import { useCart, useWishlist } from "@/hooks/use-av-store";

const CATEGORIES = [
  "All",
  "eBooks",
  "Courses",
  "Templates",
  "Audio",
  "Finance",
  "Leadership",
  "Purpose",
  "Business",
];

export function MarketHeader() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchState = useRouterState({
    select: (s) => s.location.search as unknown,
  }) as Record<string, unknown> | undefined;
  const activeCat = (searchState?.category as string) ?? "All";
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");
  const wishlist = useWishlist();
  const cart = useCart();

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/products", search: { q, category: activeCat } as never });
  };

  const goCategory = (c: string) => {
    navigate({ to: "/products", search: { category: c } as never });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40">
      {/* Top bar */}
      <div className="bg-navy">
        <div className="mx-auto flex h-[60px] max-w-7xl items-center gap-3 px-4 md:h-[72px] md:gap-6 md:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="text-white md:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <AVLogo />

          <form
            onSubmit={onSearch}
            className="relative ml-auto hidden flex-1 max-w-[40%] md:flex"
          >
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search eBooks, courses, templates..."
              className="h-11 w-full rounded-full bg-white pl-5 pr-14 text-[14px] text-ink placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="submit"
              aria-label="Search"
              className="absolute right-1 top-1 flex h-9 w-11 items-center justify-center rounded-full bg-gold text-navy"
            >
              <Search size={16} />
            </motion.button>
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-0 md:gap-2">
            <HeaderIcon label="Sign In" icon={<User size={20} />} />
            <HeaderIcon
              label="Wishlist"
              icon={<Heart size={20} />}
              badge={wishlist.count}
            />
            <HeaderIcon
              label="Cart"
              icon={<ShoppingBag size={20} />}
              badge={cart.count}
            />
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={onSearch} className="px-4 pb-3 md:hidden">
          <div className="relative">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the vault..."
              className="h-11 w-full rounded-full bg-white pl-5 pr-14 text-[14px] text-ink placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1 top-1 flex h-9 w-11 items-center justify-center rounded-full bg-gold text-navy"
            >
              <Search size={16} />
            </button>
          </div>
        </form>
      </div>

      {/* Category bar */}
      <div className="bg-navy-2 hidden md:block">
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-1 overflow-x-auto px-8">
          {CATEGORIES.map((c) => {
            const active = activeCat === c || (c === "All" && pathname === "/");
            return (
              <button
                key={c}
                onClick={() => goCategory(c)}
                className="relative flex h-10 items-center px-3 text-[13px] text-white/85 hover:text-white"
              >
                {c}
                {active && (
                  <motion.span
                    layoutId="cat-underline"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-gold"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile category scroll */}
      <div className="bg-navy-2 md:hidden">
        <div className="flex h-10 items-center gap-1 overflow-x-auto px-4">
          {CATEGORIES.map((c) => {
            const active = activeCat === c;
            return (
              <button
                key={c}
                onClick={() => goCategory(c)}
                className={`relative whitespace-nowrap px-3 text-[13px] ${
                  active ? "text-white" : "text-white/70"
                }`}
              >
                {c}
                {active && (
                  <motion.span
                    layoutId="cat-underline-m"
                    className="absolute -bottom-0.5 left-2 right-2 h-[2px] bg-gold"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed inset-0 z-50 flex flex-col bg-navy text-white md:hidden"
          >
            <div className="flex items-center justify-between px-4 py-5">
              <AVLogo />
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X size={24} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-6 pt-4">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    goCategory(c);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between border-b border-white/10 py-4 font-display text-2xl"
                >
                  <span>{c}</span>
                  {activeCat === c && (
                    <span className="h-2 w-2 rounded-full bg-gold" />
                  )}
                </button>
              ))}
            </nav>
            <div className="p-6">
              <Link
                to="/products"
                onClick={() => setMenuOpen(false)}
                className="block w-full rounded-full bg-gold py-3 text-center text-sm font-semibold text-navy"
              >
                Shop the Vault
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeaderIcon({
  icon,
  label,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
    >
      {icon}
      {badge && badge > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
