type Props = {
  title: string;
  category: string;
  productId?: string;
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
    ["#0b1226", "#1f3a6b"], // deep navy
    ["#04261c", "#1e6f4a"], // dark emerald
    ["#3a0d18", "#7a1f2e"], // rich burgundy
    ["#0a1c2e", "#1d4d7a"], // midnight blue
    ["#0d2218", "#286b3e"], // forest
    ["#2a0a14", "#681d2c"], // garnet
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

export function ProductCover({ title, category, productId, className }: Props) {
  const kind = normalize(category);
  const seed = hashSeed((productId ?? "") + "::" + title + "::" + category);
  const palette = PALETTES[kind] ?? PALETTES.business;
  const pair = palette[seed % palette.length];
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
      {kind === "template" && <TemplateCover gid={gid} title={title} seed={seed} />}
      {kind === "audio" && <AudioCover gid={gid} lines={lines} seed={seed} />}
      {(kind === "finance" || kind === "business") && (
        <FinanceCover gid={gid} lines={lines} seed={seed} category={category} />
      )}
      {kind === "leadership" && <EbookCover gid={gid} lines={lines} category={category} />}
      {kind === "purpose" && <CourseCover gid={gid} lines={lines} category={category} />}
    </svg>
  );
}

function EbookCover({ gid, lines, category }: { gid: string; lines: string[]; category: string }) {
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
          y="42"
          textAnchor="middle"
          fill={`url(#${gid}-gold)`}
          fontFamily="ui-sans-serif, system-ui"
          fontSize="10"
          fontWeight="700"
          letterSpacing="3.5"
        >
          {category.toUpperCase()}
        </text>
        <line x1="60" y1="56" x2="220" y2="56" stroke={`url(#${gid}-gold)`} strokeWidth="0.8" />
        {lines.map((l, i) => (
          <text
            key={i}
            x="140"
            y={130 + i * 26}
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="Playfair Display, Georgia, serif"
            fontSize="20"
            fontWeight="700"
          >
            {l}
          </text>
        ))}
        <text x="140" y="232" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="7" letterSpacing="3">
          AURUMVAULT
        </text>
      </g>
    </g>
  );
}

function CourseCover({ gid, lines, category }: { gid: string; lines: string[]; category: string }) {
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
      {lines.map((l, i) => (
        <text
          key={i}
          x="30"
          y={130 + i * 28}
          fill="#ffffff"
          fontFamily="Playfair Display, Georgia, serif"
          fontSize="22"
          fontWeight="700"
        >
          {l}
        </text>
      ))}
      <g transform="translate(310 210)">
        <circle r="40" fill="rgba(0,0,0,0.32)" stroke={`url(#${gid}-gold)`} strokeWidth="1.5" />
        <path d="M-11 -15 L19 0 L-11 15 Z" fill={`url(#${gid}-gold)`} />
      </g>
      <text x="30" y="275" fill="rgba(255,255,255,0.55)" fontSize="9" letterSpacing="3">
        12 LESSONS · HD VIDEO
      </text>
    </g>
  );
}

function TemplateCover({ gid, title, seed }: { gid: string; title: string; seed: number }) {
  // Light grey background with Navy wireframe at 20% opacity.
  const variant = seed % 3;
  return (
    <g>
      <rect width="400" height="300" fill="#eef1f6" />
      {/* faint navy grid */}
      <g stroke="#0f1629" strokeOpacity="0.08">
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="300" />
        ))}
        {Array.from({ length: 15 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 20} x2="400" y2={i * 20} />
        ))}
      </g>

      {variant === 0 && (
        <g fill="#0f1629" fillOpacity="0.2" stroke="#0f1629" strokeOpacity="0.2">
          <rect x="30" y="30" width="120" height="120" rx="4" fill="none" strokeWidth="1.5" />
          <rect x="170" y="30" width="200" height="56" rx="4" fill="none" strokeWidth="1.5" />
          <rect x="170" y="96" width="200" height="54" rx="4" fill="none" strokeWidth="1.5" />
          <rect x="30" y="170" width="340" height="40" rx="4" fill="none" strokeWidth="1.5" />
        </g>
      )}
      {variant === 1 && (
        <g fill="none" stroke="#0f1629" strokeOpacity="0.2" strokeWidth="1.5">
          {[0, 1, 2].map((c) =>
            [0, 1].map((r) => (
              <rect key={`${c}-${r}`} x={30 + c * 120} y={30 + r * 100} width="100" height="80" rx="4" />
            )),
          )}
        </g>
      )}
      {variant === 2 && (
        <g fill="none" stroke="#0f1629" strokeOpacity="0.2" strokeWidth="1.5">
          <rect x="30" y="30" width="80" height="180" rx="4" />
          <rect x="125" y="30" width="245" height="60" rx="4" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={125 + i * 85} y="105" width="75" height="105" rx="4" />
          ))}
        </g>
      )}

      <text
        x="30"
        y="265"
        fill="#0f1629"
        fontFamily="Playfair Display, Georgia, serif"
        fontSize="20"
        fontWeight="700"
      >
        {title.length > 28 ? title.slice(0, 26) + "…" : title}
      </text>
      <text
        x="30"
        y="285"
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

function AudioCover({ gid, lines, seed }: { gid: string; lines: string[]; seed: number }) {
  const bars = Array.from({ length: 48 }, (_, i) => {
    const n = Math.sin(i * 0.45 + (seed % 100) * 0.13) * 0.5 + 0.5;
    const m = Math.cos(i * 0.31 + (seed % 60) * 0.21) * 0.3 + 0.6;
    const h = 10 + n * m * 130;
    return { i, h };
  });
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-bg)`} />
      <g transform="translate(0 150)">
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
      {lines.map((l, i) => (
        <text
          key={i}
          x="200"
          y={240 + i * 22}
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="Playfair Display, Georgia, serif"
          fontSize="18"
          fontWeight="700"
        >
          {l}
        </text>
      ))}
      <text x="200" y="40" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9" letterSpacing="4">
        ◷ AUDIO · LOSSLESS
      </text>
    </g>
  );
}

function FinanceCover({
  gid,
  lines,
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
      <g opacity="0.1" stroke="#ffffff">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="20" y1={80 + i * 50} x2="380" y2={80 + i * 50} />
        ))}
      </g>
      <polyline points={pts.join(" ")} fill="none" stroke={`url(#${gid}-gold)`} strokeWidth="2.5" />
      <g transform="translate(30 30)">
        <rect width="86" height="20" rx="10" fill={`url(#${gid}-gold)`} />
        <text x="43" y="13" textAnchor="middle" fill="#0a1124" fontSize="9" fontWeight="800" letterSpacing="2">
          {category.toUpperCase().slice(0, 10)}
        </text>
      </g>
      {lines.map((l, i) => (
        <text
          key={i}
          x="30"
          y={90 + i * 24}
          fill="#ffffff"
          fontFamily="Playfair Display, Georgia, serif"
          fontSize="19"
          fontWeight="700"
        >
          {l}
        </text>
      ))}
      <text x="30" y="275" fill="rgba(255,255,255,0.55)" fontSize="9" letterSpacing="3">
        ILLUSTRIOUS CAPITAL™
      </text>
    </g>
  );
}
