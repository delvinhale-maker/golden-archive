import { InsiderSignup } from "@/components/insider/InsiderSignup";

export function EmailCaptureBanner() {
  return (
    <section className="bg-gradient-to-br from-[#0a1f44] via-[#0f2756] to-[#0a1f44] py-14">
      <div className="mx-auto max-w-3xl px-6 text-center text-white">
        <div className="text-[11px] font-semibold tracking-caps text-gold">
          AURUMVAULT INSIDER
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Build smarter. Discover better tools.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/70">
          Get useful digital resources, creator opportunities, marketplace releases, and
          practical business ideas delivered periodically.
        </p>
        <InsiderSignup
          source="homepage"
          variant="hero"
          buttonLabel="Join AurumVault Insider"
          className="mt-6 text-left sm:text-center"
        />
      </div>
    </section>
  );
}
