import { Link } from "@tanstack/react-router";
import { AVLogo } from "./AVLogo";

type FooterLink = { label: string; to: string; search?: Record<string, string> };

const SHOP_LINKS: FooterLink[] = [
  { label: "Shop eBooks", to: "/products", search: { category: "eBooks" } },
  { label: "Bestsellers", to: "/products", search: { sort: "bestsellers" } },
  { label: "New Releases", to: "/products", search: { sort: "new" } },
  { label: "Browse All", to: "/products" },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: "Sell on AurumVault", to: "/sell" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "Support", to: "/dashboard/help" },
];

export function MarketFooter() {
  return (
    <footer className="mt-20 bg-navy pb-24 pt-16 text-white md:pb-16">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <AVLogo size={56} />
          <p className="mt-5 max-w-sm text-sm text-white/70">
            Premium Digital Resources. Delivered Instantly.
          </p>
        </div>
        <FooterCol title="Marketplace" links={SHOP_LINKS} />
        <FooterCol title="Company" links={COMPANY_LINKS} />
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-white/10 px-6 pt-6 text-xs text-white/50 md:flex-row lg:px-8">
        <span>© {new Date().getFullYear()} AurumVault. All rights reserved.</span>
        <div className="flex gap-6 flex-wrap justify-center">
          <a href="/terms" className="hover:text-white">Terms</a>
          <a href="/privacy" className="hover:text-white">Privacy</a>
          <a href="/affiliate-disclosure" className="hover:text-white">Affiliate Disclosure</a>
          <a href="/creator-agreement" className="hover:text-white">Creator Agreement</a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <div className="mb-4 text-[11px] font-semibold tracking-caps text-gold">
        {title.toUpperCase()}
      </div>
      <ul className="space-y-2 text-sm text-white/80">
        {links.map((l) => (
          <li key={l.label}>
            <a href={buildHref(l)} className="hover:text-white">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildHref(l: FooterLink): string {
  if (!l.search) return l.to;
  const qs = new URLSearchParams(l.search).toString();
  return qs ? `${l.to}?${qs}` : l.to;
}
