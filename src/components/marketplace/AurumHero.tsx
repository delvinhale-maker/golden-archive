import {
  ArrowRight,
  BadgeCheck,
  Download,
  LayoutGrid,
  Package,
} from "lucide-react";

const NAVY = "#1B2A4A";
const NAVY_DEEP = "#11192E";
const PURPLE = "#4A1B6D";
const EMERALD = "#1B4A3A";
const EMERALD_DEEP = "#0D2E24";
const GREY = "#F5F5F5";
const GOLD = "#C9A84C";

interface MiniCoverProps {
  variant: "ebook" | "course" | "template";
  title: string;
  rotate: string;
  translate: string;
  z: number;
}

function MiniCover({ variant, title, rotate, translate, z }: MiniCoverProps) {
  const base =
    "absolute h-[260px] w-[200px] overflow-hidden rounded-[14px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-transform duration-500";

  if (variant === "ebook") {
    return (
      <div
        className={base}
        style={{
          transform: `${translate} ${rotate}`,
          zIndex: z,
          background: `linear-gradient(140deg, ${NAVY} 0%, ${PURPLE} 100%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <h4
            className="text-center text-lg leading-tight text-white"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {title}
          </h4>
        </div>
      </div>
    );
  }

  if (variant === "course") {
    return (
      <div
        className={base}
        style={{
          transform: `${translate} ${rotate}`,
          zIndex: z,
          background: `linear-gradient(135deg, ${EMERALD} 0%, ${EMERALD_DEEP} 100%)`,
        }}
      >
        <span
          className="absolute right-2.5 top-2.5 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: GOLD, color: NAVY }}
        >
          Course
        </span>
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <h4 className="text-center text-sm font-bold leading-tight text-white">
            {title}
          </h4>
        </div>
      </div>
    );
  }

  // template
  return (
    <div
      className={base}
      style={{
        transform: `${translate} ${rotate}`,
        zIndex: z,
        background: GREY,
      }}
    >
      <svg aria-hidden className="absolute inset-0 h-full w-full opacity-20">
        <defs>
          <pattern id="hwf" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0 L0 0 0 22" fill="none" stroke={NAVY} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hwf)" />
      </svg>
      <div className="absolute inset-x-5 top-5 space-y-1.5 opacity-25">
        <div className="h-2.5 w-1/3 rounded-sm" style={{ background: NAVY }} />
        <div className="h-1.5 w-2/3 rounded-sm" style={{ background: NAVY }} />
        <div className="h-1.5 w-1/2 rounded-sm" style={{ background: NAVY }} />
      </div>
      <h4
        className="absolute inset-x-4 bottom-4 text-sm font-bold leading-tight"
        style={{ color: NAVY }}
      >
        {title}
      </h4>
    </div>
  );
}

interface AurumHeroProps {
  onBrowse?: () => void;
  onSell?: () => void;
}

export function AurumHero({ onBrowse, onSell }: AurumHeroProps) {
  const stats = [
    { icon: Package, label: "32+ Products" },
    { icon: LayoutGrid, label: "18 Categories" },
    { icon: BadgeCheck, label: "Verified Creators" },
    { icon: Download, label: "Instant Download" },
  ];

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`,
      }}
    >
      {/* Gold star pattern overlay @ 8% */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='%23C9A84C'><circle cx='10' cy='14' r='1'/><circle cx='62' cy='8' r='0.8'/><circle cx='34' cy='40' r='1.2'/><circle cx='72' cy='52' r='0.9'/><circle cx='18' cy='66' r='1'/><circle cx='50' cy='70' r='0.7'/><path d='M40 6 L41 9 L44 9 L41.5 11 L42.5 14 L40 12 L37.5 14 L38.5 11 L36 9 L39 9 Z'/><path d='M8 38 L8.6 39.6 L10.3 39.6 L9 40.7 L9.5 42.3 L8 41.3 L6.5 42.3 L7 40.7 L5.7 39.6 L7.4 39.6 Z'/><path d='M66 30 L66.7 31.7 L68.5 31.7 L67.1 32.9 L67.6 34.6 L66 33.5 L64.4 34.6 L64.9 32.9 L63.5 31.7 L65.3 31.7 Z'/></g></svg>\")",
          backgroundSize: "240px 240px",
        }}
      />
      {/* soft gold radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/3 h-[500px] w-[500px] rounded-full blur-3xl"
        style={{ background: `${GOLD}33` }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:py-28">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-5">
          {/* Left 60% */}
          <div className="lg:col-span-3">
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ borderColor: `${GOLD}55`, color: GOLD }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: GOLD }}
              />
              Kingdom Resources · Royal Quality
            </div>

            <h1
              className="text-4xl leading-[1.05] text-white sm:text-5xl lg:text-6xl"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Discover Kingdom Resources
              <br />
              <span className="italic" style={{ color: GOLD }}>
                Built to Elevate Your Purpose
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base text-white/70 sm:text-lg">
              Premium eBooks, courses, templates and tools from verified Kingdom
              creators.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onBrowse}
                className="group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold transition-all duration-200 hover:shadow-[0_18px_40px_-12px_rgba(201,168,76,0.6)] active:scale-[0.98]"
                style={{ background: GOLD, color: NAVY }}
              >
                Browse Products
                <ArrowRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </button>
              <button
                type="button"
                onClick={onSell}
                className="inline-flex items-center justify-center rounded-full border-2 border-white px-7 py-3.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-white hover:text-[color:var(--navy)]"
                style={{ ["--navy" as never]: NAVY }}
              >
                Start Selling
              </button>
            </div>
          </div>

          {/* Right 40% — card stack (hidden on small) */}
          <div className="relative hidden lg:col-span-2 lg:block">
            <div className="relative mx-auto h-[360px] w-[420px]">
              {/* gold glow */}
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                style={{ background: `${GOLD}40` }}
              />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <MiniCover
                  variant="template"
                  title="Sermon Slides Kit"
                  translate="translate(-150px, 10px)"
                  rotate="rotate(-10deg)"
                  z={1}
                />
                <MiniCover
                  variant="course"
                  title="Purpose Mastery Course"
                  translate="translate(20px, -20px)"
                  rotate="rotate(4deg)"
                  z={3}
                />
                <MiniCover
                  variant="ebook"
                  title="The Kingdom Entrepreneur"
                  translate="translate(-60px, 40px)"
                  rotate="rotate(-3deg)"
                  z={2}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Divider + stats */}
        <div className="mt-14 lg:mt-20">
          <div
            className="h-px w-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${GOLD}80, transparent)`,
            }}
          />
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            {stats.map((s) => (
              <li
                key={s.label}
                className="flex min-w-0 items-center gap-2.5 text-white/85"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `${GOLD}1A`,
                    border: `1px solid ${GOLD}55`,
                  }}
                >
                  <s.icon size={16} style={{ color: GOLD }} />
                </span>
                <span className="truncate text-[13px] font-semibold sm:text-sm">
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default AurumHero;
