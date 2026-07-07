import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import financialImg from "@/assets/coll-financial.jpg";
import leadershipImg from "@/assets/coll-leadership.jpg";
import businessImg from "@/assets/coll-business.jpg";
import aiImg from "@/assets/coll-ai.jpg";
import faithImg from "@/assets/coll-faith.jpg";

type Collection = {
  title: string;
  kicker: string;
  blurb: string;
  image: string;
  to: string;
  search?: Record<string, string>;
  size: "lg" | "md";
};

const COLLECTIONS: Collection[] = [
  {
    title: "Financial Freedom",
    kicker: "The Wealth Vault",
    blurb: "Playbooks and systems from operators who've built lasting wealth.",
    image: financialImg,
    to: "/products",
    search: { category: "Finance" },
    size: "lg",
  },
  {
    title: "Kingdom Leadership",
    kicker: "Lead With Purpose",
    blurb: "Frameworks for leaders shaping people, teams, and legacy.",
    image: leadershipImg,
    to: "/products",
    search: { category: "Leadership" },
    size: "md",
  },
  {
    title: "Business Systems",
    kicker: "Build & Scale",
    blurb: "Templates, SOPs, and dashboards used by 7-figure operators.",
    image: businessImg,
    to: "/products",
    search: { category: "Business" },
    size: "md",
  },
  {
    title: "AI Prompt Vault",
    kicker: "New Frontier",
    blurb: "Curated prompt libraries and AI toolkits for modern builders.",
    image: aiImg,
    to: "/products",
    search: { category: "Templates" },
    size: "md",
  },
  {
    title: "Faith & Growth",
    kicker: "Inner Kingdom",
    blurb: "Devotionals, studies, and reflections for a rooted life.",
    image: faithImg,
    to: "/products",
    search: { category: "Purpose" },
    size: "md",
  },
];

function CollectionCard({ c, index }: { c: Collection; index: number }) {
  const isLarge = c.size === "lg";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={
        isLarge
          ? "group relative col-span-2 row-span-2 overflow-hidden rounded-3xl bg-navy shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
          : "group relative overflow-hidden rounded-3xl bg-navy shadow-[0_16px_44px_-18px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
      }
    >
      <Link
        to={c.to}
        search={c.search as never}
        className="block h-full"
        aria-label={`${c.title} collection`}
      >
        <div className={isLarge ? "relative h-[520px] w-full" : "relative h-[300px] w-full"}>
          <img
            src={c.image}
            alt={c.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08101D] via-[#08101D]/40 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
              {c.kicker}
            </div>
            <h3
              className={
                isLarge
                  ? "mt-2 font-display text-3xl leading-tight text-white md:text-4xl"
                  : "mt-2 font-display text-2xl leading-tight text-white md:text-[26px]"
              }
            >
              {c.title}
            </h3>
            {isLarge && (
              <p className="mt-3 max-w-md text-sm text-white/75 md:text-base">
                {c.blurb}
              </p>
            )}
            <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/90 transition-colors group-hover:text-gold">
              Explore collection
              <ArrowUpRight
                size={14}
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

        <div className="grid grid-cols-1 gap-5 md:grid-cols-4 md:grid-rows-2 md:gap-6">
          {COLLECTIONS.map((c, i) => (
            <CollectionCard key={c.title} c={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturedCollections;
