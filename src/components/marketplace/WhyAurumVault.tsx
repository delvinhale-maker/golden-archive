import { motion } from "framer-motion";
import whySecure from "@/assets/why-secure.jpg";
import whyInstant from "@/assets/why-instant.jpg";

import whyCurated from "@/assets/why-curated.jpg";
import whyExperience from "@/assets/why-experience.jpg";

const CARDS = [
  {
    image: whySecure,
    title: "Secure Checkout",
    copy: "Bank-grade encryption on every purchase, protected end-to-end.",
  },
  {
    image: whyInstant,
    title: "Instant Download",
    copy: "Your files land in your vault the second payment clears.",
  },
  {
    image: whyCurated,
    title: "Curated Quality",
    copy: "Editorially reviewed. If it's on AurumVault, it earned its place.",
  },
  {
    image: whyExperience,
    title: "Five-Star Experience",
    copy: "From discovery to delivery, every touchpoint is considered.",
  },
];

export function WhyAurumVault() {
  return (
    <section className="relative bg-[#F8F6F2] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-center text-center md:mb-16">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-gold-ink">
            WHY AURUMVAULT
          </div>
          <h2 className="mt-3 font-display text-3xl leading-tight text-navy md:text-5xl">
            Built for people who <span className="gold-gradient">expect more.</span>
          </h2>
          <span className="mt-5 block h-[2px] w-10 bg-gold" />
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-mute md:text-base">
            Every detail — from checkout to delivery — engineered around trust,
            quality, and the feeling of owning something worth having.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {CARDS.map((c, i) => (
            <motion.article
              key={c.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className={`group overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_-24px_rgba(15,22,41,0.25)] ring-1 ring-black/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_70px_-24px_rgba(15,22,41,0.35)] hover:ring-gold/30 ${
                i === 4 ? "sm:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <div className="relative aspect-[5/4] w-full overflow-hidden">
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/25 via-transparent to-transparent" />
              </div>
              <div className="p-6 md:p-7">
                <h3 className="font-display text-xl text-navy md:text-2xl">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-mute md:text-[15px]">
                  {c.copy}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
