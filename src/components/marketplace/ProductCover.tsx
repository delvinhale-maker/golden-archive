type Props = {
  title: string;
  category: string;
  productId?: string;
  index?: number;
  className?: string;
};

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function normalize(cat: string) {
  const c = cat.toLowerCase();
  if (c.includes("ebook") || c.includes("book")) return "ebook";
  if (c.includes("course")) return "course";
  if (c.includes("template")) return "template";
  if (c.includes("audio") || c.includes("podcast")) return "audio";
  if (c.includes("finance") || c.includes("wallet")) return "finance";
  if (c.includes("leader")) return "leadership";
  if (c.includes("purpose")) return "purpose";
  return "business";
}

// Each category gets a wide palette pool. Pairs are [from, to] hex stops.
const PALETTES: Record<string, [string, string][]> = {
  ebook: [
    ["#0b1226", "#3a1f6b"], // navy → deep purple
    ["#0f1629", "#8a6a14"], // navy → gold
    ["#06222a", "#000000"], // dark teal → black
    ["#1a0b2e", "#0b1226"], // violet → navy
    ["#0a2540", "#5b2c6f"], // ocean navy → plum
    ["#101820", "#a17a16"], // ink → gold
  ],
  course: [
    ["#0b1226", "#1f3a6b"], // 0 deep navy
    ["#04261c", "#1e6f4a"], // 1 dark emerald (green)
    ["#3a0d18", "#7a1f2e"], // 2 rich burgundy
    ["#0a1c2e", "#1d4d7a"], // 3 midnight blue
    ["#0d2218", "#286b3e"], // 4 forest (green)
    ["#2a0a14", "#681d2c"], // 5 garnet
  ],
  audio: [
    ["#000000", "#0a1124"],
    ["#02070f", "#0b1c2e"],
    ["#000000", "#1a0a1a"],
    ["#050505", "#101820"],
  ],
  finance: [
    ["#0b1226", "#1c2a52"],
    ["#0a1c2e", "#214b6e"],
    ["#101820", "#2a3a6b"],
  ],
  leadership: [
    ["#0b1226", "#3a1f6b"],
    ["#0f1629", "#8a6a14"],
    ["#06222a", "#101820"],
  ],
  purpose: [
    ["#04261c", "#1e6f4a"],
    ["#1a0b2e", "#0b1226"],
    ["#3a0d18", "#7a1f2e"],
  ],
  business: [
    ["#0b1226", "#1c2a52"],
    ["#0a1c2e", "#214b6e"],
    ["#101820", "#2a3a6b"],
  ],
};

const GOLD_GRAD: [string, string] = ["#a17a16", "#f0d27a"];

function pickTitleLines(title: string, max = 3) {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 14 && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
    if (lines.length === max - 1) break;
  }
  if (cur) lines.push(cur.trim());
  return lines.slice(0, max);
}

export function ProductCover({ title, category, productId, index, className }: Props) {
  const kind = normalize(category);
  const seed = hashSeed((productId ?? "") + "::" + title + "::" + category);
  const palette = PALETTES[kind] ?? PALETTES.business;
  // For courses/purpose (which reuses CourseCover), pick by grid index so no
  // two adjacent cards share the same gradient (palette is ordered so that
  // adjacent indices never both contain green stops).
  const useIndex = (kind === "course" || kind === "purpose") && typeof index === "number";
  const pair = palette[(useIndex ? index! : seed) % palette.length];
  const angle = [0, 45, 90, 135, 180, 225][(seed >> 3) % 6];
  const lines = pickTitleLines(title);
  const gid = `g${seed.toString(36)}`;

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={`${category} cover for ${title}`}
    >
      <defs>
        <linearGradient
          id={`${gid}-bg`}
          gradientTransform={`rotate(${angle} 0.5 0.5)`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" stopColor={pair[0]} />
          <stop offset="100%" stopColor={pair[1]} />
        </linearGradient>
        <linearGradient id={`${gid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_GRAD[0]} />
          <stop offset="100%" stopColor={GOLD_GRAD[1]} />
        </linearGradient>
        {/* 5% noise texture for eBooks */}
        <pattern id={`${gid}-noise`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="#ffffff" fillOpacity="0.04" />
          <circle cx="1" cy="1" r="0.4" fill="#ffffff" fillOpacity="0.05" />
        </pattern>
        {/* 8% diagonal lines for Courses */}
        <pattern
          id={`${gid}-diag`}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="10" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />
        </pattern>
      </defs>

      {kind === "ebook" && <EbookCover gid={gid} lines={lines} category={category} />}
      {kind === "course" && <CourseCover gid={gid} lines={lines} category={category} />}
      {kind === "template" && <TemplateCover gid={gid} title={title} seed={seed} index={index} />}
      {kind === "audio" && <AudioCover gid={gid} lines={lines} seed={seed} />}
      {(kind === "finance" || kind === "business") && (
        <FinanceCover gid={gid} lines={lines} seed={seed} category={category} />
      )}
      {kind === "leadership" && <EbookCover gid={gid} lines={lines} category={category} />}
      {kind === "purpose" && <CourseCover gid={gid} lines={lines} category={category} />}
    </svg>
  );
}

function EbookCover({ gid, category }: { gid: string; lines: string[]; category: string }) {
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-bg)`} />
      <rect width="400" height="300" fill={`url(#${gid}-noise)`} />
      <g transform="translate(60 22)">
        <rect
          x="0"
          y="0"
          width="280"
          height="256"
          rx="2"
          fill="rgba(0,0,0,0.32)"
          stroke={`url(#${gid}-gold)`}
          strokeWidth="1"
        />
        <rect x="10" y="10" width="260" height="236" fill="none" stroke="rgba(232,200,105,0.22)" strokeWidth="0.6" />
        <line x1="0" y1="0" x2="0" y2="256" stroke="rgba(0,0,0,0.55)" strokeWidth="4" />
        <text
          x="140"
          y="56"
          textAnchor="middle"
          fill={`url(#${gid}-gold)`}
          fontFamily="ui-sans-serif, system-ui"
          fontSize="10"
          fontWeight="700"
          letterSpacing="3.5"
        >
          {category.toUpperCase()}
        </text>
        <line x1="60" y1="74" x2="220" y2="74" stroke={`url(#${gid}-gold)`} strokeWidth="0.8" />
        <g transform="translate(140 150)">
          <circle r="30" fill="none" stroke={`url(#${gid}-gold)`} strokeWidth="1.2" />
          {/* Open book icon */}
          <g stroke={`url(#${gid}-gold)`} strokeWidth="1.2" strokeLinejoin="round" fill="rgba(0,0,0,0.25)">
            {/* left page */}
            <path d="M-18 -10 C -14 -12, -6 -12, -1 -8 L -1 12 C -6 8, -14 8, -18 10 Z" />
            {/* right page */}
            <path d="M18 -10 C 14 -12, 6 -12, 1 -8 L 1 12 C 6 8, 14 8, 18 10 Z" />
          </g>
          {/* page rule lines */}
          <g stroke={`url(#${gid}-gold)`} strokeOpacity="0.55" strokeWidth="0.6">
            <line x1="-14" y1="-5" x2="-4" y2="-4" />
            <line x1="-14" y1="-1" x2="-4" y2="0" />
            <line x1="-14" y1="3" x2="-4" y2="4" />
            <line x1="4" y1="-4" x2="14" y2="-5" />
            <line x1="4" y1="0" x2="14" y2="-1" />
            <line x1="4" y1="4" x2="14" y2="3" />
          </g>
        </g>
        <text x="140" y="232" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="7" letterSpacing="3">
          AURUMVAULT
        </text>
      </g>
    </g>
  );
}

function CourseCover({ gid, category }: { gid: string; lines: string[]; category: string }) {
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-bg)`} />
      <rect width="400" height="300" fill={`url(#${gid}-diag)`} />
      <g transform="translate(30 30)">
        <rect x="0" y="0" width="86" height="20" rx="10" fill={`url(#${gid}-gold)`} />
        <text x="43" y="13" textAnchor="middle" fill="#0a1124" fontSize="9" fontWeight="800" letterSpacing="2">
          {category.toUpperCase().slice(0, 10)}
        </text>
      </g>
      <g transform="translate(200 160)">
        <circle r="56" fill="rgba(0,0,0,0.32)" stroke={`url(#${gid}-gold)`} strokeWidth="1.5" />
        <path d="M-16 -22 L26 0 L-16 22 Z" fill={`url(#${gid}-gold)`} />
      </g>
      <text x="30" y="275" fill="rgba(255,255,255,0.55)" fontSize="9" letterSpacing="3">
        12 LESSONS · HD VIDEO
      </text>
    </g>
  );
}

function TemplateCover({
  seed,
  index,
}: {
  gid: string;
  title: string;
  seed: number;
  index?: number;
}) {
  // 4 distinct wireframe layouts. Use grid index when available so adjacent
  // cards never share a layout; fall back to seed for deterministic uniqueness.
  const variant = (typeof index === "number" ? index : seed) % 4;
  const stroke = { fill: "none", stroke: "#0f1629", strokeOpacity: 0.28, strokeWidth: 1.5 } as const;
  const fillSoft = "rgba(15,22,41,0.06)";
  return (
    <g>
      <rect width="400" height="300" fill="#eef1f6" />
      <g stroke="#0f1629" strokeOpacity="0.08">
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="300" />
        ))}
        {Array.from({ length: 15 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 20} x2="400" y2={i * 20} />
        ))}
      </g>

      {/* (1) 2-column grid with a wide header bar */}
      {variant === 0 && (
        <g {...stroke}>
          <rect x="30" y="30" width="340" height="44" rx="4" fill={fillSoft} />
          <rect x="30" y="90" width="160" height="170" rx="4" />
          <rect x="210" y="90" width="160" height="170" rx="4" />
          <line x1="46" y1="48" x2="180" y2="48" />
          <line x1="46" y1="58" x2="140" y2="58" />
        </g>
      )}

      {/* (2) 3-column equal grid */}
      {variant === 1 && (
        <g {...stroke}>
          {[0, 1, 2].map((c) =>
            [0, 1].map((r) => (
              <rect
                key={`${c}-${r}`}
                x={30 + c * 116}
                y={30 + r * 116}
                width="100"
                height="100"
                rx="4"
              />
            )),
          )}
        </g>
      )}

      {/* (3) dashboard: large left panel + 2 stacked right boxes */}
      {variant === 2 && (
        <g {...stroke}>
          <rect x="30" y="30" width="220" height="230" rx="4" fill={fillSoft} />
          <rect x="270" y="30" width="100" height="108" rx="4" />
          <rect x="270" y="152" width="100" height="108" rx="4" />
          {/* fake chart bars in left panel */}
          <g strokeOpacity="0.45">
            <line x1="50" y1="220" x2="50" y2="170" />
            <line x1="74" y1="220" x2="74" y2="140" />
            <line x1="98" y1="220" x2="98" y2="190" />
            <line x1="122" y1="220" x2="122" y2="120" />
            <line x1="146" y1="220" x2="146" y2="160" />
            <line x1="170" y1="220" x2="170" y2="100" />
            <line x1="194" y1="220" x2="194" y2="150" />
            <line x1="218" y1="220" x2="218" y2="180" />
          </g>
        </g>
      )}

      {/* (4) kanban: 3 vertical columns with cards */}
      {variant === 3 && (
        <g {...stroke}>
          {[0, 1, 2].map((c) => {
            const x = 30 + c * 116;
            return (
              <g key={c}>
                <rect x={x} y="30" width="100" height="230" rx="4" fill={fillSoft} />
                <rect x={x + 10} y={44} width="80" height="14" rx="2" />
                <rect x={x + 10} y={70} width="80" height="44" rx="3" />
                <rect x={x + 10} y={122} width="80" height="44" rx="3" />
                <rect x={x + 10} y={174} width="80" height="44" rx="3" />
              </g>
            );
          })}
        </g>
      )}



      <text
        x="30"
        y="290"
        fill="#0f1629"
        fillOpacity="0.55"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="9"
        letterSpacing="3"
      >
        TEMPLATE · AURUMVAULT
      </text>
    </g>
  );
}

function AudioCover({ gid, seed }: { gid: string; lines: string[]; seed: number }) {
  const bars = Array.from({ length: 48 }, (_, i) => {
    const n = Math.sin(i * 0.45 + (seed % 100) * 0.13) * 0.5 + 0.5;
    const m = Math.cos(i * 0.31 + (seed % 60) * 0.21) * 0.3 + 0.6;
    const h = 10 + n * m * 170;
    return { i, h };
  });
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-bg)`} />
      <g transform="translate(0 160)">
        {bars.map((b) => (
          <rect
            key={b.i}
            x={10 + b.i * 8}
            y={-b.h / 2}
            width="4"
            height={b.h}
            rx="2"
            fill={`url(#${gid}-gold)`}
            opacity={0.55 + ((b.i + seed) % 5) * 0.08}
          />
        ))}
      </g>
      <text x="200" y="40" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9" letterSpacing="4">
        ◷ AUDIO · LOSSLESS
      </text>
    </g>
  );
}

function FinanceCover({
  gid,
  seed,
  category,
}: {
  gid: string;
  lines: string[];
  seed: number;
  category: string;
}) {
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const x = 30 + i * 32;
    const y = 220 - ((Math.sin(i * 0.7 + (seed % 50) * 0.2) + 1) * 30 + i * 6);
    pts.push(`${x},${y}`);
  }
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-bg)`} />
      <g opacity="0.12" stroke="#ffffff">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1="20" y1={70 + i * 45} x2="380" y2={70 + i * 45} />
        ))}
      </g>
      <polyline points={pts.join(" ")} fill="none" stroke={`url(#${gid}-gold)`} strokeWidth="2.5" />
      <g transform="translate(30 30)">
        <rect width="86" height="20" rx="10" fill={`url(#${gid}-gold)`} />
        <text x="43" y="13" textAnchor="middle" fill="#0a1124" fontSize="9" fontWeight="800" letterSpacing="2">
          {category.toUpperCase().slice(0, 10)}
        </text>
      </g>
      <text x="30" y="275" fill="rgba(255,255,255,0.55)" fontSize="9" letterSpacing="3">
        ILLUSTRIOUS CAPITAL™
      </text>
    </g>
  );
}
