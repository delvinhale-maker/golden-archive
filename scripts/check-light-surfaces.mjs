#!/usr/bin/env node
/**
 * Guard against light/cream backgrounds reappearing on marketplace surfaces.
 *
 * Scans src/ for forbidden background tokens (bg-white, cream hex codes, etc.)
 * and exits non-zero when any are found. Run via `bun run check:bg` or in CI.
 *
 * To intentionally allow a specific occurrence, append `// allow-light-bg`
 * on the same line.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIR = join(ROOT, "src");

// Files/dirs explicitly exempt (legacy themed components, UI primitives
// rendered inside dark overlays, etc.).
const EXEMPT_PATHS = [
  "src/components/ui/",                          // shadcn primitives
  "src/components/marketplace/CartDrawer.tsx",   // drawer surface is intentionally light
  "src/components/marketplace/MarketHeader.tsx", // search popovers / mobile sheet
  "src/components/marketplace/NotificationsBell.tsx",
  "src/components/marketplace/UploadFab.tsx",
  "src/components/marketplace/PublisherShell.tsx",
  "src/components/marketplace/ProductDetailPage.tsx",
  "src/components/marketplace/ReviewsSection.tsx",
  "src/components/marketplace/QASection.tsx",
  "src/components/marketplace/FrequentlyBoughtTogether.tsx",
  "src/components/marketplace/ShareButtons.tsx",
  "src/components/marketplace/TrustBadges.tsx",
  "src/components/marketplace/ProductCard.tsx",
  "src/components/marketplace/PremiumProductCard.tsx",
  "src/components/marketplace/AffiliateCard.tsx",
  "src/components/marketplace/MobileTabBar.tsx",
];

// Forbidden patterns. Each entry: { re, label }.
const FORBIDDEN = [
  { re: /\bbg-white\b/, label: "bg-white" },
  { re: /\bbg-cream\b/, label: "bg-cream" },
  { re: /bg-\[#FDFAF1\]/i, label: "bg-[#FDFAF1] (cream)" },
  { re: /bg-\[#f9fafb\]/i, label: "bg-[#f9fafb] (light gray)" },
  { re: /bg-\[#fafaf7\]/i, label: "bg-[#fafaf7] (cream)" },
  { re: /bg-\[#fdf9ec\]/i, label: "bg-[#fdf9ec] (cream)" },
];

const SCAN_EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".css"]);
const ALLOW_MARKER = "allow-light-bg";

function isExempt(relPath) {
  return EXEMPT_PATHS.some((p) => relPath.startsWith(p));
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (SCAN_EXTS.has(full.slice(full.lastIndexOf(".")))) {
      yield full;
    }
  }
}

const violations = [];

for (const file of walk(SCAN_DIR)) {
  const rel = relative(ROOT, file);
  if (isExempt(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, idx) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const { re, label } of FORBIDDEN) {
      if (re.test(line)) {
        violations.push({ file: rel, line: idx + 1, label, snippet: line.trim() });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("\n✗ Light/cream surface guard failed.\n");
  console.error("The site uses --color-bg-page (#0F1E35) as the page surface.");
  console.error("Replace these backgrounds with `bg-bg-page` (or another navy");
  console.error("token), or append `// allow-light-bg` on the line if it's");
  console.error("intentional (e.g. a modal/drawer over a dark page).\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.label}`);
    console.error(`    ${v.snippet}`);
  }
  console.error(`\n${violations.length} violation(s) found.\n`);
  process.exit(1);
}

console.log("✓ No forbidden light/cream backgrounds in src/.");
