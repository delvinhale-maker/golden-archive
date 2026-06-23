import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Crown,
  Download,
  GraduationCap,
  Headphones,
  LayoutTemplate,
  Lock,
  ShieldCheck,
  Star,
  Swords,
  Wallet,
} from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  ProductCard,
  ProductCardSkeleton,
} from "@/components/marketplace/ProductCard";
import {
  getFeaturedProducts,
  getFeaturedCreators,
  type Product,
  type Creator,
} from "@/lib/marketplace.functions";

const featuredQ = queryOptions({
  queryKey: ["mp", "featured"],
  queryFn: () => getFeaturedProducts(),
});
const creatorsQ = queryOptions({
  queryKey: ["mp", "creators"],
  queryFn: () => getFeaturedCreators(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(featuredQ);
    context.queryClient.ensureQueryData(creatorsQ);
  },
  head: () => ({
    meta: [
      { title: "AurumVault — Gold Standard Digital Commerce" },
      {
        name: "description",
        content:
          "Discover premium eBooks, courses, templates, and digital resources from verified purpose-driven creators. Powered by Illustrious Capital™.",
      },
      { property: "og:title", content: "AurumVault — Gold Standard Digital Commerce" },
      {
        property: "og:description",
        content:
          "Premium digital marketplace for eBooks, courses, templates, audio, and leadership resources.",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

const CATS = [
  { label: "eBooks", icon: BookOpen, slug: "eBooks" },
  { label: "Courses", icon: GraduationCap, slug: "Courses" },
  { label: "Templates", icon: LayoutTemplate, slug: "Templates" },
  { label: "Audio", icon: Headphones, slug: "Audio" },
  { label: "Finance", icon: Wallet, slug: "Finance" },
  { label: "Leadership", icon: Crown, slug: "Leadership" },
  { label: "Purpose", icon: Swords, slug: "Purpose" },
  { label: "Business", icon: Briefcase, slug: "Business" },
];

function Home() {
  return (
    <MarketShell>
      <Hero />
      <CategoriesSection />
      <Suspense fallback={<FeaturedSkeleton />}>
        <FeaturedProducts />
      </Suspense>
      <Suspense fallback={null}>
        <FeaturedCreators />
      </Suspense>
      <TrustBar />
    </MarketShell>
  );
}

function Hero() {
  return (
    <section className="av-hero-bg relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[55%_45%] md:py-24 lg:px-8 lg:py-28">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-[11px] font-semibold tracking-caps text-gold"
          >
            AURUMVAULT — GOLD STANDARD COMMERCE
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 font-display text-4xl leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-[64px]"
          >
            Discover <span className="gold-gradient">premium</span> digital
            resources.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg"
          >
            Curated eBooks, courses, templates, and tools from verified
            purpose-driven creators.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/products"
              className="group"
            >
              <motion.span
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex h-12 items-center rounded-full bg-gold px-7 text-sm font-bold text-navy shadow-gold-glow"
              >
                Shop Now →
              </motion.span>
            </Link>
            <motion.a
              whileHover={{ scale: 1.02, backgroundColor: "#fff", color: "#0f1629" }}
              whileTap={{ scale: 0.97 }}
              href="#categories"
              className="inline-flex h-12 items-center rounded-full border border-white/70 px-7 text-sm font-bold text-white"
            >
              Start Selling →
            </motion.a>
          </motion.div>
        </div>

        <HeroStack />
      </div>
    </section>
  );
}

function HeroStack() {
  const cards = [
    {
      title: "The Stewardship Codex",
      cat: "eBook",
      price: 49,
      img: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80",
    },
    {
      title: "Sovereign Leadership",
      cat: "Course",
      price: 199,
      img: "https://images.unsplash.com/photo-1532153975070-2e9ab71f1b14?w=600&q=80",
    },
    {
      title: "Boardroom Liturgy",
      cat: "Audio",
      price: 29,
      img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80",
    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3 }}
      className="relative mx-auto hidden h-[420px] w-full max-w-md md:block"
    >
      {cards.map((c, i) => (
        <motion.div
          key={i}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 + i * 0.12 }}
          style={{
            zIndex: 10 - i,
            transform: `translate(${i * 20}px, ${i * 18}px)`,
          }}
          className="absolute right-0 top-0 w-72 overflow-hidden rounded-xl bg-white shadow-card-hover"
        >
          <div className="h-44 bg-[#f5f4ef]">
            <img src={c.img} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="p-4">
            <div className="text-[10px] font-semibold tracking-caps text-gold">
              {c.cat.toUpperCase()}
            </div>
            <div className="mt-1 font-display text-base font-bold text-ink">
              {c.title}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-gold">
                ${c.price}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-mute">
                <Star size={11} fill="var(--gold)" stroke="var(--gold)" /> 4.9
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function SectionHeader({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="mb-10 flex flex-col items-center text-center">
      {kicker && (
        <div className="text-[11px] font-semibold tracking-caps text-gold">
          {kicker}
        </div>
      )}
      <h2 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">
        {title}
      </h2>
      <span className="mt-3 block h-[2px] w-10 bg-gold" />
    </div>
  );
}

function CategoriesSection() {
  return (
    <section id="categories" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader title="Browse Categories" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {CATS.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              whileHover={{ y: -4 }}
            >
              <Link
                to="/products"
                search={{ category: c.slug } as never}
                className="av-card flex h-[120px] flex-col items-center justify-center gap-2 hover:border-gold"
              >
                <c.icon className="text-gold" size={32} strokeWidth={1.6} />
                <span className="text-sm font-bold text-navy">{c.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedProducts() {
  const { data } = useSuspenseQuery(featuredQ);
  return (
    <section className="bg-white pb-16 pt-4 md:pb-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader title="Featured Products" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
          {(data as Product[]).slice(0, 8).map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/products"
            className="inline-flex h-11 items-center rounded-full border border-navy px-6 text-sm font-bold text-navy hover:bg-navy hover:text-white"
          >
            See all products →
          </Link>
        </div>
      </div>
    </section>
  );
}

function FeaturedSkeleton() {
  return (
    <section className="bg-white pb-16 pt-4">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader title="Featured Products" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCreators() {
  const { data } = useSuspenseQuery(creatorsQ);
  return (
    <section className="bg-[#f9fafb] py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader title="Featured Creators" />
        <div className="flex gap-5 overflow-x-auto pb-3 md:grid md:grid-cols-3 md:overflow-visible">
          {(data as Creator[]).slice(0, 6).map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className="av-card min-w-[280px] overflow-hidden"
            >
              <div
                className="h-[120px]"
                style={{
                  background:
                    "linear-gradient(135deg, #0f1629 0%, #1a2744 50%, #c9a227 130%)",
                }}
              />
              <div className="px-5 pb-5">
                <img
                  src={c.avatar}
                  alt={c.name}
                  className="-mt-7 h-14 w-14 rounded-full border-[3px] border-white object-cover"
                />
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="font-display text-base font-bold text-ink">
                    {c.name}
                  </div>
                  {c.verified && (
                    <BadgeCheck size={15} className="text-emerald" />
                  )}
                </div>
                <div className="text-[13px] text-mute">{c.tagline}</div>
                <div className="mt-4 flex items-center gap-6 text-[13px]">
                  <div>
                    <div className="font-bold text-ink">{c.productsCount}</div>
                    <div className="text-[11px] text-mute">Products</div>
                  </div>
                  <div>
                    <div className="font-bold text-ink">
                      {c.salesCount.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-mute">Sales</div>
                  </div>
                </div>
                <button className="mt-4 inline-flex items-center text-sm font-bold text-gold hover:underline">
                  View Store →
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    { icon: Lock, label: "Secure Checkout" },
    { icon: ShieldCheck, label: "Verified Creators" },
    { icon: Download, label: "Instant Download" },
    { icon: Star, label: "5-Star Support" },
  ];
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-4 px-6 py-6 lg:px-8">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <it.icon size={16} className="text-gold" />
            <span className="text-[13px] font-medium text-ink">{it.label}</span>
            {i < items.length - 1 && (
              <span className="ml-4 hidden h-1 w-1 rounded-full bg-mute md:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
