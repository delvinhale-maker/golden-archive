import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { AVLogo } from "./AVLogo";
import { useAuth } from "@/hooks/use-auth";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export type PublisherAccent = {
  /** Hex accent color for this page. */
  color: string;
  /** Soft tint (with alpha) for backgrounds. */
  tint: string;
};

export const ACCENTS = {
  bookshelf: { color: "#0F1E35", tint: "rgba(15,30,53,0.06)" },
  publishStep1: { color: "#1A6B4A", tint: "rgba(26,107,74,0.08)" },
  publishStep2: { color: "#4B2D8F", tint: "rgba(75,45,143,0.08)" },
  publishStep3: { color: "#C47B00", tint: "rgba(196,123,0,0.08)" },
  publishStep4: { color: "#B8860B", tint: "rgba(184,134,11,0.10)" },
  earn: { color: "#2D6A4F", tint: "rgba(45,106,79,0.08)" },
  help: { color: "#2E5B8A", tint: "rgba(46,91,138,0.08)" },
} satisfies Record<string, PublisherAccent>;

const NAV_ITEMS = [
  { label: "Bookshelf", to: "/dashboard" as const },
  { label: "Publish", to: "/dashboard/new" as const },
  { label: "Earn", to: "/dashboard/earn" as const },
  { label: "Help", to: "/dashboard/help" as const },
];

export function PublisherShell({
  accent,
  children,
}: {
  accent: PublisherAccent;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const accountName = user?.email?.split("@")[0] ?? "Publisher";

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  return (
    <div
      className="min-h-screen transition-colors duration-300 ease-out"
      style={{
        ["--page-accent" as string]: accent.color,
        ["--page-accent-tint" as string]: accent.tint,
        background: `linear-gradient(180deg, ${accent.tint} 0%, #fafaf7 280px)`,
      }}
    >
      <PaymentTestModeBanner />
      <header className="bg-navy text-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center gap-6">
          <AVLogo />
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.to === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="relative px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
                >
                  {item.label}
                  <span
                    aria-hidden
                    className="absolute left-2 right-2 -bottom-0.5 h-[2px] rounded-full transition-all duration-300 ease-out"
                    style={{
                      background: "var(--page-accent)",
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? "scaleX(1)" : "scaleX(0.4)",
                    }}
                  />
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-white/70">{accountName}</span>
            <button
              onClick={handleSignOut}
              className="text-sm rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t border-white/10">
          <div className="mx-auto max-w-6xl px-2 flex">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.to === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="relative flex-1 text-center py-3 text-[13px] font-medium text-white/80"
                >
                  {item.label}
                  <span
                    aria-hidden
                    className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full transition-all duration-300 ease-out"
                    style={{
                      background: "var(--page-accent)",
                      opacity: isActive ? 1 : 0,
                    }}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 md:py-10">{children}</main>
    </div>
  );
}
