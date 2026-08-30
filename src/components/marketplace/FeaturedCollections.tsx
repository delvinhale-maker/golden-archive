import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import financialImg from "@/assets/coll-planners-clean.jpg";
import leadershipImg from "@/assets/coll-journals-clean.jpg";
import businessSystemsImg from "@/assets/coll-business-systems.jpg";
import businessToolsImg from "@/assets/coll-business-tools.jpg";
import qrImg from "@/assets/coll-qr.jpg";
import aiStudioImg from "@/assets/coll-ai-studio.jpg";
import faithImg from "@/assets/coll-faith.jpg";
import { accentFor } from "@/lib/categories";

type Collection = {
  title: string;
  kicker: string;
  blurb: string;
  image: string;
  alt: string;
  to: string;
  search?: Record<string, string>;
  accentSlug: string;
};

const COLLECTIONS: Collection[] = [
  {
    title: "Business Systems",
    kicker: "Build & Scale",
    blurb: "Ready-to-use digital systems, dashboards, and operator playbooks.",
    image: businessSystemsImg,
    alt: "Premium business dashboard on a laptop in a dark luxury office",
    to: "/business-systems",
    accentSlug: "business_operating_systems",
  },
  {
    title: "Interactive Planners",
    kicker: "The Wealth Vault",
    blurb: "Playbooks and systems from operators who've built lasting wealth.",
    image: financialImg,
    alt: "Interactive planners and wealth-building organizers on a clean workspace",
    to: "/products",
    search: { category: "Planners" },
    accentSlug: "financial_planners",
  },
  {
    title: "Interactive Journals",
    kicker: "Reflect & Record",
    blurb: "Interactive journals for reflection, gratitude, prayer, and creative practice.",
    image: leadershipImg,
    alt: "Interactive journals for reflection, gratitude, and creative practice",
    to: "/products",
    search: { category: "Journals" },
    accentSlug: "printable_journals",
  },
  {
    title: "Business Tools",
    kicker: "Creator Toolkit",
    blurb: "Professional tools for creators turning content into business.",
    image: businessToolsImg,
    alt: "Premium black and gold professional business tools flat lay",
    to: "/creator-business-tools",
    accentSlug: "business_operating_systems",
  },
  {
    title: "QR Code Generator",
    kicker: "Reach & Track",
    blurb: "Create branded QR codes and campaigns for your products.",
    image: qrImg,
    alt: "Gold embossed QR code card being scanned by a phone on black marble",
    to: "/dashboard/qr",
    accentSlug: "ai_prompt_packs",
  },
  {
    title: "AI Studio",
    kicker: "New Frontier",
    blurb: "Generate, refine, and package products with AI assistance.",
    image: aiStudioImg,
    alt: "Designer workstation with glowing gold AI network visualization",
    to: "/dashboard/ai-studio",
    accentSlug: "ai_prompt_packs",
  },
  {
    title: "Faith & Growth",
    kicker: "Personal Growth",
    blurb: "Devotionals, studies, and reflections for a rooted life.",
    image: faithImg,
    alt: "Faith-based devotionals and personal growth resources",
    to: "/products",
    search: { category: "eBooks" },
    accentSlug: "ebooks",
  },
];

function CollectionCard({ c, index }: { c: Collection; index: number }) {
  const accent = accentFor(c.accentSlug);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      style={{ ["--cat-accent" as string]: accent } as Record<string, string>}
      className="group relative overflow-hidden rounded-2xl bg-navy shadow-[0_16px_44px_-18px_rgba(0,0,0,0.5)] ring-1 ring-white/10 transition-shadow duration-500 hover:shadow-[0_0_0_1px_var(--cat-accent),0_20px_48px_-20px_var(--cat-accent)] md:rounded-3xl"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px]"
        style={{ background: accent }}
      />

      <Link
        to={c.to}
        search={c.search as never}
        className="block h-full"
        aria-label={`${c.title} collection`}
      >
        <div className="relative h-[168px] w-full sm:h-[220px] md:h-[280px]">
          <img
            src={c.image}
            alt={c.alt}
            loading="lazy"
            width={1024}
            height={1024}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08101D] via-[#08101D]/45 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3 md:p-6">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gold md:text-[10px]">
              {c.kicker}
            </div>
            <h3 className="mt-1 font-display text-base leading-tight text-white sm:text-xl md:text-2xl">
              {c.title}
            </h3>
            <p className="mt-1.5 hidden max-w-md text-sm text-white/75 md:block">
              {c.blurb}
            </p>
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-white/90 transition-colors group-hover:text-gold md:mt-4 md:gap-1.5 md:text-[12px]">
              Explore
              <ArrowUpRight
                size={12}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}


export function FeaturedCollections() {
  return (
    <section className="relative bg-[#08101D] py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#0B1730] to-transparent"
      />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-gold">
            FEATURED COLLECTIONS
          </div>
          <h2 className="mt-3 font-display text-4xl leading-tight text-white md:text-5xl">
            Curated Vaults for the{" "}
            <span className="gold-gradient">Ambitious.</span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-white/60">
            Hand-selected resources across the disciplines that shape modern
            builders, leaders, and creators.
          </p>
          <span className="mt-5 block h-[2px] w-10 bg-gold" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 md:gap-6">
          {COLLECTIONS.map((c, i) => (
            <CollectionCard key={c.title} c={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturedCollections;
