#!/usr/bin/env node

const REQUIRED = [
  "APP_ENV",
  "PUBLIC_SITE_URL",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SANDBOX_SECRET_KEY",
  "PAYMENTS_SANDBOX_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "EMAIL_PREVIEW_TOKEN",
  "INTEGRATION_TOKEN_ENCRYPTION_KEY",
  "CANVA_CLIENT_ID",
  "CANVA_CLIENT_SECRET",
  "CANVA_REDIRECT_URI",
  "TIKTOK_SHOP_APP_KEY",
  "TIKTOK_SHOP_APP_SECRET",
  "TIKTOK_SHOP_SERVICE_ID",
  "TIKTOK_SHOP_REDIRECT_URI",
];

const EXPECTED_REF = "ypelutaddlibqvpaekyq";
const FORBIDDEN = [
  "lovable.app",
  "lovable.dev",
  "lovableproject.com",
  "connector-gateway.lovable.dev",
  "ai.gateway.lovable.dev",
];

const failures = [];
for (const name of REQUIRED) {
  const value = process.env[name]?.trim();
  if (!value) failures.push(`${name}: missing`);
}

if (process.env.APP_ENV !== "staging") {
  failures.push("APP_ENV must equal staging");
}
if (process.env.SUPABASE_PROJECT_REF !== EXPECTED_REF) {
  failures.push(`SUPABASE_PROJECT_REF must equal ${EXPECTED_REF}`);
}

for (const name of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) {
  const value = process.env[name] ?? "";
  try {
    const host = new URL(value).hostname;
    if (host !== `${EXPECTED_REF}.supabase.co`) {
      failures.push(`${name}: not bound to independent staging`);
    }
  } catch {
    failures.push(`${name}: invalid URL`);
  }
}

for (const [name, value] of Object.entries(process.env)) {
  if (!value) continue;
  const lower = value.toLowerCase();
  if (FORBIDDEN.some((needle) => lower.includes(needle))) {
    failures.push(`${name}: contains a forbidden Lovable runtime hostname`);
  }
}

for (const name of ["CANVA_REDIRECT_URI", "TIKTOK_SHOP_REDIRECT_URI"]) {
  const value = process.env[name] ?? "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".vercel.app")) {
      failures.push(`${name}: staging callback must use an HTTPS Vercel staging host`);
    }
  } catch {
    failures.push(`${name}: invalid URL`);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ status: "BLOCKED", failures }, null, 2));
  process.exit(2);
}

console.log(JSON.stringify({
  status: "CLEAR",
  environment: "staging",
  supabase_project_ref: EXPECTED_REF,
  required_variables_present: REQUIRED.length,
  forbidden_runtime_hosts: 0,
}, null, 2));
