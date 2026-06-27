// Category color theming — used by browse hero and category badges.
// Tailwind classes are kept inline so the JIT doesn't purge them.

export type CategoryTheme = {
  bg: string;          // hero background
  ink: string;         // primary text on hero
  accent: string;      // accent text/icon
  border: string;      // subtle border
  pill: string;        // pill background
  blurb: string;       // marketing one-liner
};

const BASE: Record<string, CategoryTheme> = {
  eBooks: {
    bg: "linear-gradient(135deg,#0F1E35 0%,#1B2A4A 60%,#22335A 100%)",
    ink: "#FFFFFF",
    accent: "#C9A84C",
    border: "rgba(201,168,76,0.45)",
    pill: "rgba(201,168,76,0.14)",
    blurb: "Curated long-form reads for operators and stewards.",
  },
  Courses: {
    bg: "linear-gradient(135deg,#3A1B5C 0%,#4A1B6D 60%,#5E2A86 100%)",
    ink: "#FFFFFF",
    accent: "#E9C46A",
    border: "rgba(233,196,106,0.45)",
    pill: "rgba(233,196,106,0.14)",
    blurb: "Cohort-grade learning to compound your craft.",
  },
  Templates: {
    bg: "linear-gradient(135deg,#0D2E24 0%,#1B4A3A 60%,#226A52 100%)",
    ink: "#FFFFFF",
    accent: "#A7E8C2",
    border: "rgba(167,232,194,0.45)",
    pill: "rgba(167,232,194,0.12)",
    blurb: "Ready-to-ship systems for Notion, Figma, and Docs.",
  },
  Audio: {
    bg: "linear-gradient(135deg,#3A1A1A 0%,#5C2424 60%,#7A2E2E 100%)",
    ink: "#FFFFFF",
    accent: "#F4A261",
    border: "rgba(244,162,97,0.45)",
    pill: "rgba(244,162,97,0.14)",
    blurb: "Listen-anywhere audio for deep work and reflection.",
  },
  Finance: {
    bg: "linear-gradient(135deg,#102C24 0%,#1A4F3F 60%,#1F6B6B 100%)",
    ink: "#FFFFFF",
    accent: "#C9A84C",
    border: "rgba(201,168,76,0.45)",
    pill: "rgba(201,168,76,0.14)",
    blurb: "Spreadsheets, atlases, and frameworks for patient capital.",
  },
  Leadership: {
    bg: "linear-gradient(135deg,#11192E 0%,#1B2A4A 60%,#2C3D6B 100%)",
    ink: "#FFFFFF",
    accent: "#C9A84C",
    border: "rgba(201,168,76,0.45)",
    pill: "rgba(201,168,76,0.14)",
    blurb: "Playbooks and liturgies for the long-game leader.",
  },
  Purpose: {
    bg: "linear-gradient(135deg,#2A1A3C 0%,#3F2756 60%,#5C3A7A 100%)",
    ink: "#FFFFFF",
    accent: "#E9C46A",
    border: "rgba(233,196,106,0.45)",
    pill: "rgba(233,196,106,0.14)",
    blurb: "Build with intention. Measure outcomes in legacy.",
  },
  Business: {
    bg: "linear-gradient(135deg,#0F1E35 0%,#1B355B 60%,#244680 100%)",
    ink: "#FFFFFF",
    accent: "#C9A84C",
    border: "rgba(201,168,76,0.45)",
    pill: "rgba(201,168,76,0.14)",
    blurb: "Operator essentials for builders of quiet empires.",
  },
};

const DEFAULT: CategoryTheme = {
  bg: "linear-gradient(135deg,#0F1E35 0%,#1B2A4A 60%,#22335A 100%)",
  ink: "#FFFFFF",
  accent: "#C9A84C",
  border: "rgba(201,168,76,0.45)",
  pill: "rgba(201,168,76,0.14)",
  blurb: "Premium digital products from verified creators.",
};

export function getCategoryTheme(category?: string | null): CategoryTheme {
  if (!category) return DEFAULT;
  return BASE[category] ?? DEFAULT;
}
