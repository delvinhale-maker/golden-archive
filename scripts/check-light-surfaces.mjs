#!/usr/bin/env node
/**
 * Dark-surface guard for the public homepage and marketplace rows.
 *
 * The homepage uses --color-bg-page (#0F1E35) as the page surface; the
 * sections below were explicitly darkened and must not regress to white
 * or cream backgrounds in future builds.
 *
 * Scope is intentionally narrow: only the files that drive the public
 * homepage hero / rows are checked. Other parts of the app (auth pages,
 * admin/seller dashboards, product detail, etc.) still use light surfaces
 * and are out of scope for this guard.
 *
 * To intentionally allow a single line, append `// allow-light-bg`.
 *
 * Run: `node scripts/check-light-surfaces.mjs`
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// Files watched by the guard. Keep this list focused on public homepage
// surfaces. Add a file here when you darken a new public section.
const WATCHED_FILES = [
  "src/components/marketplace/HomeRows.tsx",
  "src/components/marketplace/KingdomBibleAppBanner.tsx",
  "src/components/marketplace/KingdomPicksRow.tsx",
  "src/components/marketplace/BestsellersRow.tsx",
  "src/components/marketplace/DealsStrip.tsx",
];

// In src/routes/index.tsx the homepage is composed of many sub-sections;
// we only check the section/component functions that were darkened.
// Each entry is a function name; the guard scans that function body only.
const WATCHED_INDEX_FUNCTIONS = [
  "CategoriesSection",
  "FeaturedProducts",
  "FeaturedSkeleton",
  "IllustriousCreator",
  "TrustBar",
];

// Forbidden patterns. `(?!\/)` ignores translucent overlays like `bg-white/10`.
const FORBIDDEN = [
  { re: /\bbg-white\b(?!\/)/, label: "bg-white" },
  { re: /\bbg-cream\b(?!\/)/, label: "bg-cream" },
  { re: /bg-\[#FDFAF1\]/i, label: "bg-[#FDFAF1] (cream)" },
  { re: /bg-\[#f9fafb\]/i, label: "bg-[#f9fafb] (light gray)" },
  { re: /bg-\[#fafaf7\]/i, label: "bg-[#fafaf7] (cream)" },
  { re: /bg-\[#fdf9ec\]/i, label: "bg-[#fdf9ec] (cream)" },
];
const ALLOW_MARKER = "allow-light-bg";

const violations = [];

function scanLines(file, startLine, lines) {
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const { re, label } of FORBIDDEN) {
      if (re.test(line)) {
        violations.push({
          file,
          line: startLine + i,
          label,
          snippet: line.trim(),
        });
      }
    }
  });
}

for (const rel of WATCHED_FILES) {
  const full = join(ROOT, rel);
  if (!existsSync(full)) continue;
  const lines = readFileSync(full, "utf8").split("\n");
  scanLines(rel, 1, lines);
}

// Scan only the listed function bodies in src/routes/index.tsx.
const indexPath = join(ROOT, "src/routes/index.tsx");
if (existsSync(indexPath)) {
  const text = readFileSync(indexPath, "utf8");
  const allLines = text.split("\n");
  for (const fn of WATCHED_INDEX_FUNCTIONS) {
    const re = new RegExp(`^function\\s+${fn}\\b`);
    const start = allLines.findIndex((l) => re.test(l));
    if (start === -1) continue;
    // Body ends at the next top-level `}` followed by blank/`function`.
    let end = allLines.length - 1;
    for (let i = start + 1; i < allLines.length; i++) {
      if (allLines[i] === "}") {
        end = i;
        break;
      }
    }
    scanLines(
      `src/routes/index.tsx [${fn}]`,
      start + 1,
      allLines.slice(start, end + 1),
    );
  }
}

if (violations.length > 0) {
  console.error("\n✗ Dark-surface guard failed.\n");
  console.error(
    "The public homepage uses --color-bg-page (#0F1E35). Replace these",
  );
  console.error(
    "backgrounds with `bg-bg-page` (or another navy token), or append",
  );
  console.error("`// allow-light-bg` on the line if it is intentional.\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.label}`);
    console.error(`    ${v.snippet}`);
  }
  console.error(`\n${violations.length} violation(s) found.\n`);
  process.exit(1);
}

console.log("✓ Homepage / marketplace rows are free of light surfaces.");
