#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['package.json', 'vite.config.ts', 'src', 'supabase'];
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.toml', '.md', '.sql', '.yml', '.yaml', '.env', '',
]);

const MARKERS = [
  { id: 'lovable-package', re: /@lovable\.dev\//g, severity: 'blocker' },
  { id: 'lovable-api-key', re: /LOVABLE_API_KEY/g, severity: 'blocker' },
  { id: 'lovable-stripe-gateway', re: /connector-gateway\.lovable\.dev\/stripe/g, severity: 'blocker' },
  { id: 'lovable-ai-gateway', re: /ai\.gateway\.lovable\.dev/g, severity: 'blocker' },
  { id: 'lovable-email-route', re: /\/lovable\/email\//g, severity: 'blocker' },
  { id: 'lovable-auth', re: /createLovableAuth|lovable\.auth\./g, severity: 'blocker' },
  { id: 'lovable-email-dispatch', re: /sendLovableEmail/g, severity: 'blocker' },
  { id: 'lovable-preview-domain', re: /lovableproject\.com|lovableproject-dev\.com|lovable\.app|gptengineer\.run|gpt-eng\.com/g, severity: 'review' },
  { id: 'lovable-text', re: /Lovable Cloud|Connect Supabase in Lovable Cloud/g, severity: 'review' },
];

function collect(target, out = []) {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) return out;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    const ext = path.extname(abs);
    if (TEXT_EXTENSIONS.has(ext) || path.basename(abs).startsWith('.env')) out.push(abs);
    return out;
  }
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.output', 'coverage'].includes(entry.name)) continue;
    collect(path.join(target, entry.name), out);
  }
  return out;
}

const files = SCAN_ROOTS.flatMap((p) => collect(p));
const findings = [];

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const rel = path.relative(ROOT, file).replaceAll(path.sep, '/');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const marker of MARKERS) {
      marker.re.lastIndex = 0;
      if (marker.re.test(lines[i])) {
        findings.push({
          severity: marker.severity,
          marker: marker.id,
          file: rel,
          line: i + 1,
          preview: lines[i].trim().slice(0, 220),
        });
      }
    }
  }
}

const blockers = findings.filter((f) => f.severity === 'blocker');
const reviews = findings.filter((f) => f.severity === 'review');

console.log(JSON.stringify({
  status: blockers.length ? 'BLOCKED' : 'CLEAR',
  scanned_files: files.length,
  blocker_count: blockers.length,
  review_count: reviews.length,
  findings,
}, null, 2));

process.exitCode = blockers.length ? 2 : 0;
