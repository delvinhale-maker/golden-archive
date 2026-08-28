#!/usr/bin/env node
/**
 * Single "publish readiness" action.
 *
 * Re-checks, in order:
 *   1. Route registration — required routes are present in src/routes/ AND in
 *      the generated route tree (src/routeTree.gen.ts).
 *   2. Production build status — TypeScript typecheck + `vite build`.
 *
 * Then prints one summary block. Exit code 0 = ready to publish, 1 = not ready.
 *
 * Usage: bun run check:publish-ready
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();

/** Routes that must stay reachable in production. Path = URL, file = route module. */
const REQUIRED_ROUTES = [
  { url: "/", file: "src/routes/index.tsx" },
  { url: "/dashboard/integrations", file: null },
  { url: "/api/public/integrations/canva/callback", file: null },
];

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- 1. Route registration ----------
console.log("\n▶ Route registration");
const treePath = resolve(ROOT, "src/routeTree.gen.ts");
if (!existsSync(treePath)) {
  record("Generated route tree present", false, "src/routeTree.gen.ts missing");
} else {
  const tree = readFileSync(treePath, "utf8");
  record("Generated route tree present", true, "src/routeTree.gen.ts");
  for (const route of REQUIRED_ROUTES) {
    const inTree = tree.includes(`'${route.url}'`) || tree.includes(`"${route.url}"`);
    const fileOk = !route.file || existsSync(join(ROOT, route.file));
    record(
      `Route registered: ${route.url}`,
      inTree && fileOk,
      inTree ? (fileOk ? "in route tree" : `module missing: ${route.file}`) : "not in route tree",
    );
  }
}

// ---------- 2. Production build status ----------
console.log("\n▶ Production build status");
const runStep = (name, cmd) => {
  try {
    execSync(cmd, { stdio: "inherit" });
    record(name, true);
  } catch (err) {
    record(name, false, (err.message ?? String(err)).split("\n")[0]);
  }
};
runStep("TypeScript typecheck (tsgo --noEmit)", "bunx tsgo --noEmit");
runStep("Vite production build", "bun run build");

// ---------- Summary ----------
const failed = results.filter((r) => !r.ok);
console.log("\n──────── PUBLISH READINESS SUMMARY ────────");
for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
console.log("───────────────────────────────────────────");
if (failed.length) {
  console.log(`RESULT: NOT READY TO PUBLISH — ${failed.length} check(s) failed:`);
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
  process.exit(1);
}
console.log("RESULT: READY TO PUBLISH — routes registered and production build passing.");
console.log("Reminder: changes only go live after Publish is clicked.");
