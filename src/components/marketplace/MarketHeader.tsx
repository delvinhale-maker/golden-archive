import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookPlus,
  ChevronDown,
  Heart,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  Store,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AVLogo } from "./AVLogo";
import { ProductCover } from "./ProductCover";
import { useCart, useWishlist, openCartDrawer } from "@/hooks/use-av-store";
import { useAuth } from "@/hooks/use-auth";
import { getProducts } from "@/lib/marketplace.functions";
import { NotificationsBell } from "./NotificationsBell";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIES = [
  "All",
  "AI Prompt Packs",
  "eBooks",
  "Journals",
  "Financial Planners",
];



export function MarketHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchState = useRouterState({
    select: (s) => s.location.search,
  }) as unknown as Record<string, unknown> | undefined;
  const activeCat = (searchState?.category as string) ?? "All";
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");
  const wishlist = useWishlist();
  const cart = useCart();
  const { user, isAdmin, isSeller } = useAuth();
  const canUpload = isAdmin || isSeller;

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

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
      <div
        className="scheme-surface-bg relative"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(10,15,28,0.72), rgba(10,15,28,0.72))",
          backgroundColor: "var(--scheme-bg)",
        }}
      >
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

          <div className="relative ml-auto hidden flex-1 max-w-[40%] md:flex">
            <LiveSearch
              q={q}
              setQ={setQ}
              onSubmit={onSearch}
              onPick={() => setQ("")}
            />
          </div>

          <div className="ml-auto flex items-center gap-1 md:ml-0 md:gap-2">
            <Link
              to="/academy"
              data-nav-tab
              data-active={pathname.startsWith("/academy") ? "true" : "false"}
              className="hidden md:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10"
            >
              Academy
            </Link>
            <CreatorsMenu />
            {canUpload ? (
              <Link
                to="/dashboard/new"
                data-tab-cta="solid"
                className="hidden md:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold hover:opacity-90"
              >
                <BookPlus size={14} /> Publish
              </Link>
            ) : (
              <Link
                to="/sell"
                data-tab-cta="outline"
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium"
              >
                <Store size={14} /> Sell on AurumVault
              </Link>
            )}

            {user ? (
              <>
                <NotificationsBell />
                <Link
                  to="/account"
                  aria-label="Account"
                  data-nav-tab
                  data-active={pathname.startsWith("/account") ? "true" : "false"}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <User size={20} />
                </Link>
                <Link
                  to="/dashboard"
                  aria-label="Dashboard"
                  data-nav-tab
                  data-active={pathname.startsWith("/dashboard") ? "true" : "false"}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <LayoutDashboard size={20} />
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  aria-label="Sign out"
                  className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  aria-label="Sign in"
                  data-nav-tab
                  data-active={pathname.startsWith("/auth") ? "true" : "false"}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <User size={20} />
                </Link>
                <Link
                  to="/auth"
                  className="hidden md:inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                >
                  Forgot password?
                </Link>
              </>
            )}

            <Link
              to="/wishlist"
              aria-label="Wishlist"
              data-nav-tab
              data-active={pathname.startsWith("/wishlist") ? "true" : "false"}
              className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
            >
              <Heart size={20} />
              {wishlist.count > 0 && (
                <span
                  data-tab-badge
                  className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                >
                  {wishlist.count}
                </span>
              )}
            </Link>
            <HeaderIcon
              label="Cart"
              icon={<ShoppingBag size={20} />}
              badge={cart.count}
              onClick={openCartDrawer}
            />
          </div>

        </div>

        {/* Mobile search */}
        <div className="px-4 pb-3 md:hidden">
          <LiveSearch
            q={q}
            setQ={setQ}
            onSubmit={onSearch}
            onPick={() => setQ("")}
            placeholder="Search the vault..."
          />
        </div>
      </div>

      {/* Category bar */}
      <div
        className="scheme-surface-bg hidden md:block"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(10,15,28,0.85), rgba(10,15,28,0.85))",
          backgroundColor: "var(--scheme-bg)",
        }}
      >
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-1 overflow-x-auto px-8">
          {CATEGORIES.map((c) => {
            const active = activeCat === c || (c === "All" && pathname === "/");
            return (
              <button
                key={c}
                onClick={() => goCategory(c)}
                data-nav-tab
                data-active={active ? "true" : "false"}
                className="relative flex h-10 items-center px-3 text-[13px]"
              >
                {c}
                {active && (
                  <motion.span
                    layoutId="cat-underline"
                    data-nav-underline
                    className="absolute bottom-0 left-2 right-2 h-[2px]"
                  />
                )}
              </button>

            );
          })}
        </div>
      </div>

      {/* Mobile category scroll */}
      <div
        className="scheme-surface-bg md:hidden"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(10,15,28,0.85), rgba(10,15,28,0.85))",
          backgroundColor: "var(--scheme-bg)",
        }}
      >
        <div className="flex h-10 items-center gap-1 overflow-x-auto px-4">
          {CATEGORIES.map((c) => {
            const active = activeCat === c;
            return (
              <button
                key={c}
                onClick={() => goCategory(c)}
                data-nav-tab
                data-active={active ? "true" : "false"}
                className="relative whitespace-nowrap px-3 text-[13px]"
              >
                {c}
                {active && (
                  <motion.span
                    layoutId="cat-underline-m"
                    data-nav-underline
                    className="absolute -bottom-0.5 left-2 right-2 h-[2px]"
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
                    <span data-nav-dot className="h-2 w-2 rounded-full" />
                  )}

                </button>
              ))}
              <Link
                to="/academy"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center justify-between border-b border-white/10 py-3 text-base"
              >
                <span>Academy</span>
              </Link>
              <div className="mt-2 pt-4 text-[11px] font-semibold tracking-caps text-gold/80">
                CREATORS
              </div>
              {[
                { to: "/creators", label: "Browse Creators" },
                { to: "/become-a-creator", label: "Become a Creator" },
                { to: "/creator-dashboard", label: "Creator Dashboard" },
              ].map((it) => (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center justify-between border-b border-white/10 py-3 text-base"
                >
                  <span>{it.label}</span>
                </Link>
              ))}
            </nav>
            <div className="space-y-3 p-6 pt-0">
              {canUpload ? (
                <Link
                  to="/dashboard/new"
                  onClick={() => setMenuOpen(false)}
                  data-tab-cta="solid"
                  className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-center text-sm font-semibold"
                >
                  <BookPlus size={16} /> Publish
                </Link>
              ) : (
                <Link
                  to="/sell"
                  onClick={() => setMenuOpen(false)}
                  data-tab-cta="outline"
                  className="block w-full rounded-full border py-3 text-center text-sm font-semibold"
                >
                  Sell on AurumVault
                </Link>
              )}
              {user ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full rounded-full bg-white/10 py-3 text-center text-sm font-semibold text-white"
                  >
                    My account
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full rounded-full bg-white/10 py-3 text-center text-sm font-semibold text-white"
                  >
                    My dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void handleSignOut();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-center text-sm font-semibold text-white"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full rounded-full bg-white/10 py-3 text-center text-sm font-semibold text-white"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full rounded-full border border-white/20 py-3 text-center text-sm font-semibold text-white"
                  >
                    Forgot password?
                  </Link>
                </>
              )}
              <Link
                to="/products"
                onClick={() => setMenuOpen(false)}
                data-tab-cta="solid"
                className="block w-full rounded-full py-3 text-center text-sm font-semibold"
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

/* ------------------------------- Creators menu ------------------------------ */

function CreatorsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const items: { to: string; label: string }[] = [
    { to: "/creators", label: "Browse Creators" },
    { to: "/become-a-creator", label: "Become a Creator" },
    { to: "/creator-dashboard", label: "Creator Dashboard" },
  ];
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10"
      >
        <Users size={14} /> Creators
        <ChevronDown size={12} className={open ? "rotate-180 transition" : "transition"} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className="absolute right-0 top-[38px] z-50 min-w-[200px] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-2xl"
          >
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-ink hover:bg-[#fafaf7] hover:text-navy"
              >
                {it.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------- Live search dropdown --------------------------- */

function LiveSearch({
  q,
  setQ,
  onSubmit,
  onPick,
  placeholder = "Search eBooks, courses, templates...",
}: {
  q: string;
  setQ: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onPick: () => void;
  placeholder?: string;
}) {
  const [debounced, setDebounced] = useState(q);
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const enabled = debounced.length >= 2;
  const query = useQuery({
    queryKey: ["search-suggest", debounced],
    enabled,
    queryFn: () => getProducts({ data: { q: debounced, page: 1 } }),
    staleTime: 30_000,
  });

  const items = (query.data?.items ?? []).slice(0, 6);
  const open = focused && enabled;

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={onSubmit} className="relative w-full">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-[52px] z-50 overflow-hidden rounded-xl border border-line bg-white shadow-2xl"
          >
            {query.isLoading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-mute">
                <Loader2 size={14} className="animate-spin" /> Searching...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-mute">
                No matches for "{debounced}"
              </div>
            ) : (
              <>
                <ul className="max-h-[60vh] overflow-y-auto py-1">
                  {items.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onPick();
                          setFocused(false);
                          navigate({ to: "/products/$id", params: { id: p.id } });
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#fafaf7]"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-[#f5f4ef]">
                          <ProductCover
                            title={p.title}
                            category={p.category}
                            productId={p.id}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink">
                            {p.title}
                          </div>
                          <div className="text-[11px] text-mute">
                            {p.category} · ${p.price}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setFocused(false);
                    navigate({ to: "/products", search: { q: debounced } as never });
                  }}
                  className="block w-full border-t border-line bg-[#fafaf7] py-2.5 text-center text-xs font-bold uppercase tracking-caps text-navy hover:text-gold-ink"
                >
                  See all results for "{debounced}" →
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HeaderIcon({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-nav-tab
      className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
    >

      {icon}
      {badge && badge > 0 ? (
        <span
          data-tab-badge
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
        >
          {badge}
        </span>
      ) : null}

    </button>
  );
}
