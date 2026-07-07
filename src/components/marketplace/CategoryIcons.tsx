// Luxury line-illustration icons for the 13 marketplace categories.
// Rendered as inline SVGs with hairline strokes, gold accents, and
// subtle navy fills. Designed to feel like editorial engraving marks
// rather than generic UI glyphs.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const BASE_PROPS = {
  viewBox: "0 0 48 48",
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// Shared palette references (kept inline so icons render identically
// regardless of the surrounding CSS variable scope).
const GOLD = "#C9A227";
const GOLD_SOFT = "#E7C15A";
const INK = "#F5EFE0"; // warm off-white line
const NAVY_FILL = "rgba(20, 34, 60, 0.55)";

// ————————————————————————————————————————————————————————————————
// Individual icons
// ————————————————————————————————————————————————————————————————

function EbookIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* open book base */}
      <path
        d="M6 12 C 14 10, 22 12, 24 15 C 26 12, 34 10, 42 12 L 42 38 C 34 36, 26 38, 24 41 C 22 38, 14 36, 6 38 Z"
        fill={NAVY_FILL}
        stroke={INK}
        strokeWidth="1.2"
      />
      <path d="M24 15 L 24 41" stroke={GOLD} strokeWidth="1" />
      <path d="M11 18 L 20 19.5 M11 23 L 20 24 M11 28 L 20 28" stroke={INK} strokeWidth="0.9" opacity="0.7" />
      <path d="M28 19.5 L 37 18 M28 24 L 37 23 M28 28 L 37 28" stroke={INK} strokeWidth="0.9" opacity="0.7" />
      {/* gold ribbon bookmark */}
      <path d="M32 10 L 32 22 L 34.5 19.5 L 37 22 L 37 10 Z" fill={GOLD} opacity="0.9" />
    </svg>
  );
}

function FinancialPlannerIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* planner cover */}
      <rect x="10" y="7" width="28" height="34" rx="2.5" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      {/* rings */}
      <path d="M10 14 L 8 14 M10 20 L 8 20 M10 26 L 8 26 M10 32 L 8 32" stroke={GOLD} strokeWidth="1.1" />
      {/* gold coin sigil */}
      <circle cx="24" cy="22" r="6.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M24 18 L 24 26 M21 20.5 C 22 19, 26 19, 26.5 20.5 C 27 22, 21 22, 21.5 23.5 C 22 25, 26 25, 27 23.5" stroke={GOLD_SOFT} strokeWidth="1" />
      {/* ascending bars */}
      <path d="M14 35 L 14 33 M18 35 L 18 31 M22 35 L 22 29 M26 35 L 26 32 M30 35 L 30 30 M34 35 L 34 27" stroke={INK} strokeWidth="1.1" opacity="0.85" />
    </svg>
  );
}

function AIPromptIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* diamond core */}
      <path d="M24 6 L 40 24 L 24 42 L 8 24 Z" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      {/* inner rotated square */}
      <path d="M24 14 L 34 24 L 24 34 L 14 24 Z" stroke={GOLD} strokeWidth="1" />
      {/* sparks */}
      <path d="M24 20 L 24 28 M20 24 L 28 24" stroke={GOLD_SOFT} strokeWidth="1.2" />
      <circle cx="24" cy="24" r="1.6" fill={GOLD} />
      {/* orbit dots */}
      <circle cx="24" cy="8.5" r="0.9" fill={GOLD} />
      <circle cx="39.5" cy="24" r="0.9" fill={GOLD} />
      <circle cx="24" cy="39.5" r="0.9" fill={GOLD} />
      <circle cx="8.5" cy="24" r="0.9" fill={GOLD} />
    </svg>
  );
}

function BusinessTemplateIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* back sheet */}
      <rect x="12" y="9" width="24" height="30" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      {/* clipboard clip */}
      <rect x="19" y="6" width="10" height="5" rx="1.2" stroke={GOLD} strokeWidth="1.1" fill="none" />
      <line x1="16" y1="17" x2="32" y2="17" stroke={INK} strokeWidth="0.9" opacity="0.75" />
      <line x1="16" y1="22" x2="32" y2="22" stroke={INK} strokeWidth="0.9" opacity="0.75" />
      <line x1="16" y1="27" x2="28" y2="27" stroke={INK} strokeWidth="0.9" opacity="0.75" />
      {/* gold seal */}
      <circle cx="30" cy="33" r="3.2" fill={GOLD} opacity="0.9" />
      <path d="M28.5 33 L 29.7 34.2 L 31.5 32.2" stroke="#0B1220" strokeWidth="1.1" />
    </svg>
  );
}

function BudgetSpreadsheetIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="7" y="10" width="34" height="28" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      {/* grid */}
      <line x1="7" y1="17" x2="41" y2="17" stroke={INK} strokeWidth="0.9" opacity="0.7" />
      <line x1="7" y1="24" x2="41" y2="24" stroke={INK} strokeWidth="0.7" opacity="0.5" />
      <line x1="7" y1="31" x2="41" y2="31" stroke={INK} strokeWidth="0.7" opacity="0.5" />
      <line x1="18" y1="10" x2="18" y2="38" stroke={INK} strokeWidth="0.7" opacity="0.5" />
      <line x1="29" y1="10" x2="29" y2="38" stroke={INK} strokeWidth="0.7" opacity="0.5" />
      {/* gold trend line */}
      <path d="M10 34 L 16 30 L 22 32 L 28 26 L 34 22 L 38 18" stroke={GOLD} strokeWidth="1.3" fill="none" />
      <circle cx="38" cy="18" r="1.5" fill={GOLD} />
    </svg>
  );
}

function JournalIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* journal */}
      <rect x="10" y="7" width="26" height="34" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      {/* spine */}
      <line x1="14" y1="7" x2="14" y2="41" stroke={GOLD} strokeWidth="1" />
      {/* quill */}
      <path d="M32 14 L 20 30 L 17 33 L 19 31 L 21 33" stroke={INK} strokeWidth="1.1" fill="none" />
      <path d="M32 14 C 33 17, 30 20, 26 23 C 28 21, 30 18, 32 14 Z" fill={GOLD} opacity="0.9" />
      {/* ribbon */}
      <path d="M34 7 L 34 20 L 32 18 L 30 20 L 30 7" stroke={GOLD_SOFT} strokeWidth="1" fill={GOLD} opacity="0.35" />
    </svg>
  );
}

function ChildrensIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* graduation cap */}
      <path d="M4 20 L 24 12 L 44 20 L 24 28 Z" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      <path d="M12 23 L 12 32 C 16 36, 32 36, 36 32 L 36 23" stroke={INK} strokeWidth="1.2" fill="none" />
      {/* tassel */}
      <path d="M40 21 L 40 30" stroke={GOLD} strokeWidth="1.1" />
      <circle cx="40" cy="31.5" r="1.6" fill={GOLD} />
      {/* small star sparks */}
      <path d="M8 32 L 8 36 M6 34 L 10 34" stroke={GOLD_SOFT} strokeWidth="1" />
    </svg>
  );
}

function BibleStudyIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* closed book */}
      <rect x="9" y="8" width="30" height="32" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      <line x1="14" y1="12" x2="14" y2="36" stroke={GOLD} strokeWidth="0.9" opacity="0.7" />
      {/* gold cross */}
      <path d="M24 15 L 24 31 M20 21 L 28 21" stroke={GOLD} strokeWidth="1.6" />
      {/* rays */}
      <path d="M18 33 L 15 36 M30 33 L 33 36" stroke={GOLD_SOFT} strokeWidth="0.9" opacity="0.7" />
    </svg>
  );
}

function CourseIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* play monitor */}
      <rect x="6" y="10" width="36" height="24" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      <path d="M20 18 L 30 22 L 20 26 Z" fill={GOLD} />
      {/* stand */}
      <path d="M18 38 L 30 38 M24 34 L 24 38" stroke={INK} strokeWidth="1.1" />
      {/* laurels */}
      <path d="M9 20 C 6 22, 6 26, 9 28" stroke={GOLD_SOFT} strokeWidth="1" fill="none" />
      <path d="M39 20 C 42 22, 42 26, 39 28" stroke={GOLD_SOFT} strokeWidth="1" fill="none" />
    </svg>
  );
}

function ToolkitIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* attaché case */}
      <rect x="6" y="14" width="36" height="24" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      <path d="M18 14 L 18 10 C 18 9, 19 8, 20 8 L 28 8 C 29 8, 30 9, 30 10 L 30 14" stroke={INK} strokeWidth="1.2" fill="none" />
      {/* gold latch */}
      <rect x="21" y="22" width="6" height="4" rx="1" fill={GOLD} />
      <line x1="6" y1="24" x2="42" y2="24" stroke={GOLD} strokeWidth="0.9" opacity="0.6" />
      {/* corner rivets */}
      <circle cx="10" cy="18" r="0.8" fill={GOLD} />
      <circle cx="38" cy="18" r="0.8" fill={GOLD} />
      <circle cx="10" cy="34" r="0.8" fill={GOLD} />
      <circle cx="38" cy="34" r="0.8" fill={GOLD} />
    </svg>
  );
}

function BusinessOSIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* central gear */}
      <circle cx="24" cy="24" r="7" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      <circle cx="24" cy="24" r="2.4" fill={GOLD} />
      {/* teeth */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="24"
          y1="12"
          x2="24"
          y2="9"
          stroke={INK}
          strokeWidth="1.3"
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
      {/* orbit nodes connected */}
      <circle cx="10" cy="10" r="2.2" stroke={GOLD} strokeWidth="1" fill={NAVY_FILL} />
      <circle cx="38" cy="10" r="2.2" stroke={GOLD} strokeWidth="1" fill={NAVY_FILL} />
      <circle cx="10" cy="38" r="2.2" stroke={GOLD} strokeWidth="1" fill={NAVY_FILL} />
      <circle cx="38" cy="38" r="2.2" stroke={GOLD} strokeWidth="1" fill={NAVY_FILL} />
      <path d="M12 12 L 19 19 M36 12 L 29 19 M12 36 L 19 29 M36 36 L 29 29" stroke={GOLD_SOFT} strokeWidth="0.8" opacity="0.7" />
    </svg>
  );
}

function AudioIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* headphones */}
      <path d="M10 26 C 10 15, 38 15, 38 26" stroke={INK} strokeWidth="1.3" fill="none" />
      <rect x="7" y="24" width="7" height="12" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      <rect x="34" y="24" width="7" height="12" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      {/* gold note */}
      <path d="M22 20 L 22 34" stroke={GOLD} strokeWidth="1.3" />
      <path d="M22 20 L 30 18 L 30 22" stroke={GOLD} strokeWidth="1.3" fill="none" />
      <ellipse cx="20.5" cy="34" rx="2.5" ry="1.8" fill={GOLD} />
      <ellipse cx="28.5" cy="32" rx="2.5" ry="1.8" fill={GOLD} />
    </svg>
  );
}

function TemplatesIcon(props: IconProps) {
  return (
    <svg {...BASE_PROPS} {...props}>
      {/* stacked sheets */}
      <rect x="13" y="8" width="26" height="30" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      <rect x="9" y="12" width="26" height="30" rx="2" fill={NAVY_FILL} stroke={INK} strokeWidth="1.2" />
      {/* front sheet lines */}
      <line x1="13" y1="19" x2="27" y2="19" stroke={INK} strokeWidth="0.9" opacity="0.75" />
      <line x1="13" y1="24" x2="31" y2="24" stroke={INK} strokeWidth="0.9" opacity="0.75" />
      <line x1="13" y1="29" x2="25" y2="29" stroke={INK} strokeWidth="0.9" opacity="0.75" />
      {/* gold corner fold */}
      <path d="M35 12 L 35 18 L 41 12 Z" fill={GOLD} />
      <path d="M35 18 L 41 18 L 41 12" stroke={GOLD_SOFT} strokeWidth="0.9" fill="none" />
    </svg>
  );
}

// ————————————————————————————————————————————————————————————————
// Registry
// ————————————————————————————————————————————————————————————————

export const CATEGORY_ICONS: Record<
  string,
  (props: IconProps) => JSX.Element
> = {
  ebooks: EbookIcon,
  financial_planners: FinancialPlannerIcon,
  ai_prompt_packs: AIPromptIcon,
  business_templates: BusinessTemplateIcon,
  budget_spreadsheets: BudgetSpreadsheetIcon,
  printable_journals: JournalIcon,
  childrens_educational: ChildrensIcon,
  bible_studies: BibleStudyIcon,
  courses: CourseIcon,
  digital_toolkits: ToolkitIcon,
  business_operating_systems: BusinessOSIcon,
  audio: AudioIcon,
  templates: TemplatesIcon,
};

export function CategoryLineIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[slug] ?? EbookIcon;
  return <Icon className={className} aria-hidden />;
}
