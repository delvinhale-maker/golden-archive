type Props = {
  title: string;
  category: string;
  className?: string;
};

function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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

const NAVY_GRADS: [string, string][] = [
  ["#0b1226", "#1c2a52"],
  ["#0f1629", "#2a3a6b"],
  ["#091022", "#1a234a"],
  ["#0d1430", "#23306b"],
];

const GOLD_GRADS: [string, string][] = [
  ["#8a6a14", "#e8c869"],
  ["#a17a16", "#f0d27a"],
  ["#7a5d10", "#d4af3d"],
];

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

export function ProductCover({ title, category, className }: Props) {
  const kind = normalize(category);
  const seed = hashSeed(title + category);
  const navy = NAVY_GRADS[seed % NAVY_GRADS.length];
  const gold = GOLD_GRADS[seed % GOLD_GRADS.length];
  const lines = pickTitleLines(title);
  const gid = `g${seed}`;

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={`${category} cover for ${title}`}
    >
      <defs>
        <linearGradient id={`${gid}-navy`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={navy[0]} />
          <stop offset="100%" stopColor={navy[1]} />
        </linearGradient>
        <linearGradient id={`${gid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gold[0]} />
          <stop offset="100%" stopColor={gold[1]} />
        </linearGradient>
        <linearGradient id={`${gid}-mix`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={navy[0]} />
          <stop offset="60%" stopColor={navy[1]} />
          <stop offset="100%" stopColor={gold[1]} />
        </linearGradient>
      </defs>

      {kind === "ebook" && <EbookCover gid={gid} lines={lines} category={category} />}
      {kind === "course" && <CourseCover gid={gid} lines={lines} />}
      {kind === "template" && <TemplateCover gid={gid} title={title} />}
      {kind === "audio" && <AudioCover gid={gid} lines={lines} seed={seed} />}
      {kind === "finance" && <FinanceCover gid={gid} lines={lines} seed={seed} />}
      {kind === "leadership" && <EbookCover gid={gid} lines={lines} category={category} />}
      {kind === "purpose" && <CourseCover gid={gid} lines={lines} />}
      {kind === "business" && <FinanceCover gid={gid} lines={lines} seed={seed} />}
    </svg>
  );
}

function EbookCover({ gid, lines, category }: { gid: string; lines: string[]; category: string }) {
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-navy)`} />
      {/* book shape */}
      <g transform="translate(120 35)">
        <rect x="0" y="0" width="160" height="230" rx="3" fill="#0a1124" stroke={`url(#${gid}-gold)`} strokeWidth="1.5" />
        <rect x="6" y="6" width="148" height="218" fill="none" stroke="rgba(232,200,105,0.25)" strokeWidth="0.6" />
        <line x1="0" y1="0" x2="0" y2="230" stroke="rgba(0,0,0,0.5)" strokeWidth="3" />
        <text x="80" y="36" textAnchor="middle" fill={`url(#${gid}-gold)`} fontFamily="ui-sans-serif, system-ui" fontSize="9" fontWeight="700" letterSpacing="3">
          {category.toUpperCase()}
        </text>
        <line x1="30" y1="50" x2="130" y2="50" stroke={`url(#${gid}-gold)`} strokeWidth="0.7" />
        {lines.map((l, i) => (
          <text
            key={i}
            x="80"
            y={110 + i * 22}
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="Playfair Display, Georgia, serif"
            fontSize="17"
            fontWeight="700"
          >
            {l}
          </text>
        ))}
        <text x="80" y="210" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="7" letterSpacing="2">
          AURUMVAULT
        </text>
      </g>
    </g>
  );
}

function CourseCover({ gid, lines }: { gid: string; lines: string[] }) {
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-mix)`} />
      <circle cx="320" cy="60" r="80" fill="rgba(232,200,105,0.12)" />
      <circle cx="60" cy="260" r="100" fill="rgba(255,255,255,0.04)" />
      <g transform="translate(30 30)">
        <rect x="0" y="0" width="58" height="18" rx="9" fill={`url(#${gid}-gold)`} />
        <text x="29" y="12" textAnchor="middle" fill="#0a1124" fontSize="9" fontWeight="800" letterSpacing="2">
          COURSE
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
      {/* play badge */}
      <g transform="translate(290 200)">
        <circle r="38" fill="rgba(0,0,0,0.35)" stroke={`url(#${gid}-gold)`} strokeWidth="1.5" />
        <path d="M-10 -14 L18 0 L-10 14 Z" fill={`url(#${gid}-gold)`} />
      </g>
      <text x="30" y="270" fill="rgba(255,255,255,0.55)" fontSize="9" letterSpacing="3">
        12 LESSONS · HD VIDEO
      </text>
    </g>
  );
}

function TemplateCover({ gid, title }: { gid: string; title: string }) {
  return (
    <g>
      <rect width="400" height="300" fill="#eef1f6" />
      <rect x="0" y="0" width="400" height="32" fill="#ffffff" />
      <circle cx="14" cy="16" r="4" fill="#ff5f57" />
      <circle cx="28" cy="16" r="4" fill="#febc2e" />
      <circle cx="42" cy="16" r="4" fill="#28c840" />
      <rect x="60" y="9" width="200" height="14" rx="3" fill="#f1f3f7" />
      <text x="68" y="19" fontFamily="ui-monospace, monospace" fontSize="8" fill="#7a8398">
        aurumvault.app
      </text>

      {/* sidebar */}
      <rect x="0" y="32" width="80" height="268" fill={`url(#${gid}-navy)`} />
      <rect x="12" y="48" width="56" height="6" rx="2" fill={`url(#${gid}-gold)`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="12" y={72 + i * 18} width="56" height="6" rx="2" fill="rgba(255,255,255,0.18)" />
      ))}

      {/* hero card */}
      <rect x="96" y="48" width="288" height="80" rx="6" fill="#ffffff" stroke="#e4e7ee" />
      <rect x="108" y="60" width="120" height="10" rx="2" fill="#0f1629" />
      <rect x="108" y="78" width="200" height="6" rx="2" fill="#9aa2b4" />
      <rect x="108" y="92" width="170" height="6" rx="2" fill="#c4cad6" />
      <rect x="108" y="108" width="64" height="14" rx="7" fill={`url(#${gid}-gold)`} />

      {/* metric cards */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${96 + i * 96} 140)`}>
          <rect width="88" height="70" rx="6" fill="#ffffff" stroke="#e4e7ee" />
          <rect x="10" y="12" width="38" height="6" rx="2" fill="#9aa2b4" />
          <rect x="10" y="26" width="48" height="14" rx="2" fill="#0f1629" />
          <rect x="10" y="50" width="60" height="6" rx="2" fill={`url(#${gid}-gold)`} />
        </g>
      ))}

      {/* chart */}
      <rect x="96" y="220" width="288" height="68" rx="6" fill="#ffffff" stroke="#e4e7ee" />
      <polyline
        points="106,272 140,258 170,264 200,244 230,250 260,232 296,238 330,220 370,228"
        fill="none"
        stroke={`url(#${gid}-gold)`}
        strokeWidth="2"
      />
      <text x="200" y="295" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontSize="7" fill="#7a8398" letterSpacing="2">
        {title.slice(0, 36).toUpperCase()}
      </text>
    </g>
  );
}

function AudioCover({ gid, lines, seed }: { gid: string; lines: string[]; seed: number }) {
  const bars = Array.from({ length: 48 }, (_, i) => {
    const n = Math.sin(i * 0.6 + seed) * 0.5 + 0.5;
    const h = 12 + n * 110;
    return { i, h };
  });
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-navy)`} />
      <g transform="translate(0 175)">
        {bars.map((b) => (
          <rect
            key={b.i}
            x={10 + b.i * 8}
            y={-b.h / 2}
            width="4"
            height={b.h}
            rx="2"
            fill={`url(#${gid}-gold)`}
            opacity={0.55 + (b.i % 5) * 0.08}
          />
        ))}
      </g>
      <g transform="translate(30 32)">
        <rect width="64" height="18" rx="9" fill={`url(#${gid}-gold)`} />
        <text x="32" y="12" textAnchor="middle" fill="#0a1124" fontSize="9" fontWeight="800" letterSpacing="2">
          AUDIO
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
      <text x="30" y="280" fill="rgba(255,255,255,0.5)" fontSize="9" letterSpacing="3">
        ◷ 3h 12m · LOSSLESS
      </text>
    </g>
  );
}

function FinanceCover({ gid, lines, seed }: { gid: string; lines: string[]; seed: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const x = 30 + i * 32;
    const y = 220 - ((Math.sin(i * 0.7 + seed) + 1) * 30 + i * 6);
    pts.push(`${x},${y}`);
  }
  return (
    <g>
      <rect width="400" height="300" fill={`url(#${gid}-navy)`} />
      <g opacity="0.08" stroke="#ffffff">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="20" y1={80 + i * 50} x2="380" y2={80 + i * 50} />
        ))}
      </g>
      <polyline points={pts.join(" ")} fill="none" stroke={`url(#${gid}-gold)`} strokeWidth="2.5" />
      <g transform="translate(30 30)">
        <rect width="74" height="18" rx="9" fill={`url(#${gid}-gold)`} />
        <text x="37" y="12" textAnchor="middle" fill="#0a1124" fontSize="9" fontWeight="800" letterSpacing="2">
          PREMIUM
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
