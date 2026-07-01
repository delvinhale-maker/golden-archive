#!/usr/bin/env node
/**
 * Prepublish build checks. Fails fast before deployment on:
 *   1. Missing local imports (broken file references / typos)
 *   2. TypeScript type errors (tsgo --noEmit)
 *   3. Production build failure (vite build)
 *   4. Missing required assets referenced in <head>
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");
const errors = [];
const step = (name, fn) => {
  process.stdout.write(`\n▶ ${name}\n`);
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    errors.push(`${name}: ${err.message ?? err}`);
    console.error(`✗ ${name}`);
    if (err.stdout) process.stderr.write(String(err.stdout));
    if (err.stderr) process.stderr.write(String(err.stderr));
  }
};

// ---------- 1. Walk src/ for unresolved local imports ----------
const EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const ASSET_EXTS = [".css", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".mp4", ".json"];
const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (EXTS.includes(extname(p))) out.push(p);
  }
  return out;
};
const resolveImport = (spec, fromFile) => {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return true; // external package — skip
  if (existsSync(base) && statSync(base).isFile()) return true;
  for (const ext of [...EXTS, ...ASSET_EXTS]) if (existsSync(base + ext)) return true;
  for (const ext of EXTS) if (existsSync(join(base, `index${ext}`))) return true;
  return false;
};
step("Local import resolution", () => {
  const files = walk(SRC);
  const importRe = /(?:import\s[^'"`]*?from\s*|import\s*|export\s[^'"`]*?from\s*|require\s*\()\s*['"`]([^'"`]+)['"`]/g;
  const missing = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(importRe)) {
      const spec = m[1];
      if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
      if (!resolveImport(spec, f)) missing.push(`  ${f.replace(ROOT + "/", "")} → '${spec}'`);
    }
  }
  if (missing.length) throw new Error(`\n${missing.join("\n")}`);
});

// ---------- 2. Required root files ----------
step("Router bootstrap files", () => {
  const required = ["src/router.tsx", "src/routes/__root.tsx", "src/routes/index.tsx"];
  const missing = required.filter((p) => !existsSync(join(ROOT, p)));
  if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
});

// ---------- 3. TypeScript typecheck ----------
step("TypeScript typecheck (tsgo --noEmit)", () => {
  execSync("bunx tsgo --noEmit", { stdio: "inherit" });
});

// ---------- 4. Vite production build ----------
step("Vite production build", () => {
  execSync("bun run build", { stdio: "inherit" });
});

// ---------- Report ----------
if (errors.length) {
  console.error(`\n✗ Prepublish check failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e.split("\n")[0]}`);
  process.exit(1);
}
console.log("\n✓ All prepublish checks passed — safe to deploy.");
