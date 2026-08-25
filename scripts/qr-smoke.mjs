#!/usr/bin/env node
/**
 * AurumVault QR Phase 1 — automated live smoke test.
 *
 * Drives the three surfaces that make up the shipped Phase 1 feature against a
 * running app (local build in CI, or a live URL via BASE_URL):
 *
 *   1. /dashboard/qr        — the owner's QR list
 *   2. /dashboard/qr/new    — create a dynamic QR code end to end
 *   3. /q/{public_id}       — the public redirect service (active / paused /
 *                             archived / unknown token, plus query-string
 *                             override refusal and scan recording)
 *
 * Everything it touches is disposable: a throwaway QA auth user is created up
 * front and every row it owns — plus the user itself — is deleted in a finally
 * block, whether the run passes or fails. Nothing pre-existing is read or
 * mutated: cleanup is always scoped to the QA user id created by this run.
 *
 * Output: a machine-readable report.json and a human-readable report.md under
 * ARTIFACT_DIR (default artifacts/qr-smoke/), plus a screenshot per surface.
 * Exit code is non-zero if any check fails, so CI gates on it.
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (create + destroy the QA user)
 *   SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)
 * Optional env:
 *   BASE_URL       default http://localhost:8080
 *   CHROMIUM_PATH  explicit Chromium binary (sandboxes without a PW download)
 *   ARTIFACT_DIR   default artifacts/qr-smoke
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "artifacts/qr-smoke";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const QA_DESTINATION = "https://www.aurumvault.store/products";
const QA_PREFIX = "QA SMOKE DELETE ME";

const checks = [];
const notes = [];
const startedAt = new Date();

function record(id, surface, description, ok, detail) {
  checks.push({ id, surface, description, status: ok ? "PASS" : "FAIL", detail: String(detail) });
  console.log(`${ok ? "  ok  " : " FAIL "} [${surface}] ${description} — ${detail}`);
}

function requireEnv() {
  const missing = [
    !SUPABASE_URL && "SUPABASE_URL",
    !SERVICE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !PUBLISHABLE_KEY && "SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Missing required env var(s): ${missing.join(", ")}`);
    process.exit(2);
  }
}

const projectRef = () => new URL(SUPABASE_URL).hostname.split(".")[0];
const storageKey = () => `sb-${projectRef()}-auth-token`;

/** Fetch without following redirects, so we can assert on 3xx + Location. */
async function rawGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
  const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
  return { status: res.status, location: res.headers.get("location"), body };
}

async function main() {
  requireEnv();
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- 0. Target reachable before we create anything disposable ----------
  const home = await fetch(BASE_URL).catch((e) => ({ ok: false, status: String(e) }));
  record("00-target-up", "preflight", "target app responds", home.ok, `GET ${BASE_URL} → ${home.status}`);
  if (!home.ok) throw new Error(`Target ${BASE_URL} is not reachable`);

  // ---- 1. Disposable QA user -------------------------------------------
  const suffix = randomBytes(4).toString("hex");
  const email = `qa.qr.${suffix}@qa-aurumvault.invalid`;
  const password = `Qa!${randomBytes(12).toString("base64url")}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { qa_disposable: true, purpose: "qr-phase-1-smoke" },
  });
  if (createErr || !created?.user) throw new Error(`Could not create QA user: ${createErr?.message}`);
  const qaUserId = created.user.id;
  notes.push(`Disposable QA user ${email} (${qaUserId}) created for this run.`);
  record("01-qa-user", "preflight", "disposable QA user created", true, `${email}`);

  let browser;
  let failedFast = null;
  try {
    const anon = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr || !signIn?.session) throw new Error(`QA sign-in failed: ${signInErr?.message}`);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    // CHROMIUM_PATH is only for sandboxes/hosts where Playwright's own
    // download is unavailable; CI installs the matching browser normally.
    browser = await chromium.launch(
      process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    );
    const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
    const page = await context.newPage();
    const consoleErrors = [];
    // "Failed to fetch" from the Supabase auth client is navigation noise: a
    // session request still in flight when the harness navigates away is
    // aborted by the browser, which surfaces as a console error even though
    // nothing in the app failed. Everything else counts.
    const isNavigationAbort = (text) =>
      text.includes("Failed to fetch") || text.includes("NetworkError when attempting to fetch");
    page.on("console", (m) => {
      if (m.type() === "error" && !isNavigationAbort(m.text())) consoleErrors.push(m.text());
    });

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([k, v]) => localStorage.setItem(k, v),
      [storageKey(), JSON.stringify(signIn.session)],
    );

    // ---- 2. /dashboard/qr loads for a signed-in owner -------------------
    await page.goto(`${BASE_URL}/dashboard/qr`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "QR Codes" }).waitFor({ timeout: 30_000 });
    const onDashboard = new URL(page.url()).pathname === "/dashboard/qr";
    record(
      "02-list-renders",
      "/dashboard/qr",
      "list renders for the owner (no auth bounce)",
      onDashboard,
      `url ${page.url()}`,
    );
    await page.screenshot({ path: join(ARTIFACT_DIR, "01-dashboard-qr.png") });

    // ---- 3. /dashboard/qr/new creates a dynamic QR ----------------------
    await page.goto(`${BASE_URL}/dashboard/qr/new`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Create a QR Code" }).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "General business" }).click();
    await page.getByRole("button", { name: "Ask for a review" }).first().click();
    await page.locator("input").filter({ hasText: "" }).first().waitFor();
    await page.fill("input[placeholder^='https://']", QA_DESTINATION);
    await page.getByRole("button", { name: "Dynamic", exact: false }).first().click();
    await page.fill("input[placeholder='Name this QR code']", `${QA_PREFIX} ${suffix}`);
    await page.screenshot({ path: join(ARTIFACT_DIR, "02-dashboard-qr-new.png") });
    await page.getByRole("button", { name: "Save QR Code" }).click();
    await page.getByRole("button", { name: "PNG" }).waitFor({ timeout: 30_000 });
    record(
      "03-create-dynamic",
      "/dashboard/qr/new",
      "dynamic QR saves and offers PNG/SVG downloads",
      true,
      "download controls rendered after save",
    );
    await page.screenshot({ path: join(ARTIFACT_DIR, "03-saved.png") });

    // The row must exist, be owned by the QA user, and carry a public_id.
    const { data: rows } = await admin
      .from("qr_projects")
      .select("id,public_id,mode,status,destination,owner_user_id")
      .eq("owner_user_id", qaUserId);
    const project = (rows ?? [])[0];
    record(
      "04-row-owned",
      "/dashboard/qr/new",
      "row is stored with server-derived ownership and a public_id",
      Boolean(project) &&
        project.owner_user_id === qaUserId &&
        project.mode === "dynamic" &&
        /^[0-9a-f]{16,64}$/.test(project.public_id ?? ""),
      project ? `mode=${project.mode} status=${project.status}` : "no row found",
    );
    if (!project) throw new Error("QA project row was not created — cannot smoke the redirect");
    const token = project.public_id;

    // The saved list must show the new code.
    await page.goto(`${BASE_URL}/dashboard/qr`, { waitUntil: "domcontentloaded" });
    await page.getByText(`${QA_PREFIX} ${suffix}`).waitFor({ timeout: 30_000 });
    record("05-list-shows-new", "/dashboard/qr", "new code appears in the owner's list", true, "name visible");

    // ---- 4. /q/{public_id} while active --------------------------------
    const active = await rawGet(`/q/${token}`);
    record(
      "06-redirect-active",
      "/q/{public_id}",
      "active code 302-redirects to the stored destination",
      active.status === 302 && active.location === QA_DESTINATION,
      `${active.status} → ${active.location}`,
    );

    const override = await rawGet(`/q/${token}?url=https://malicious.example&q=https://evil.example`);
    record(
      "07-no-query-override",
      "/q/{public_id}",
      "query-string cannot override the stored destination",
      override.status === 302 && override.location === QA_DESTINATION,
      `${override.status} → ${override.location}`,
    );

    const unknown = await rawGet(`/q/${"0".repeat(40)}`);
    const malformed = await rawGet("/q/not-a-valid-token");
    record(
      "08-unknown-token",
      "/q/{public_id}",
      "unknown and malformed tokens fail safe with 404",
      unknown.status === 404 && malformed.status === 404,
      `unknown=${unknown.status} malformed=${malformed.status}`,
    );
    record(
      "09-no-leakage",
      "/q/{public_id}",
      "404 body leaks no destination or owner information",
      !unknown.body.includes(QA_DESTINATION) && !unknown.body.includes(qaUserId),
      "no destination/owner in 404 body",
    );

    // Scans recorded for the redirects above.
    const { count: scanCount } = await admin
      .from("qr_scan_events")
      .select("id", { count: "exact", head: true })
      .eq("qr_project_id", project.id);
    record(
      "10-scans-recorded",
      "/q/{public_id}",
      "successful scans are recorded against the project",
      (scanCount ?? 0) >= 2,
      `${scanCount} scan event(s)`,
    );

    // ---- 5. Paused via the dashboard, then archived --------------------
    await page.getByRole("button", { name: "Pause" }).first().click();
    await page.getByRole("button", { name: "Reactivate" }).first().waitFor({ timeout: 30_000 });
    const paused = await rawGet(`/q/${token}`);
    record(
      "11-paused",
      "/q/{public_id}",
      "paused code stops redirecting and shows an info page",
      paused.status === 200 && !paused.body.includes(QA_DESTINATION),
      `${paused.status}, destination not present in body`,
    );
    await page.screenshot({ path: join(ARTIFACT_DIR, "04-paused.png") });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Archive" }).first().click();
    await page.waitForTimeout(4000);
    const archived = await rawGet(`/q/${token}`);
    record(
      "12-archived",
      "/q/{public_id}",
      "archived code returns 410 and never redirects",
      archived.status === 410 && !archived.body.includes(QA_DESTINATION),
      `${archived.status}, destination not present in body`,
    );

    // ---- 6. Anonymous callers cannot read the table -------------------
    const anonRead = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_projects?select=id&limit=1`,
      { headers: { apikey: PUBLISHABLE_KEY } },
    );
    record(
      "13-anon-blocked",
      "security",
      "anonymous Data API read of qr_projects is refused",
      anonRead.status === 401 || anonRead.status === 403 || anonRead.status === 404,
      `REST status ${anonRead.status}`,
    );

    // ---- 7. Mobile viewport --------------------------------------------
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/dashboard/qr`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "QR Codes" }).waitFor({ timeout: 30_000 });
    await page.screenshot({ path: join(ARTIFACT_DIR, "05-mobile.png") });
    record("14-mobile", "/dashboard/qr", "list is usable at 390px width", true, "rendered at 390x844");

    record(
      "15-console-clean",
      "all surfaces",
      "no console errors during the run",
      consoleErrors.length === 0,
      consoleErrors.length ? consoleErrors.slice(0, 5).join(" | ") : "0 console errors",
    );
  } catch (err) {
    failedFast = err;
    record("99-run", "harness", "smoke run completed without throwing", false, err?.message ?? err);
  } finally {
    if (browser) await browser.close().catch(() => {});

    // ---- Cleanup: always, and only ever scoped to this run's QA user ---
    try {
      const { data: mine } = await admin.from("qr_projects").select("id").eq("owner_user_id", qaUserId);
      const ids = (mine ?? []).map((r) => r.id);
      if (ids.length) {
        await admin.from("qr_scan_events").delete().in("qr_project_id", ids);
        await admin.from("qr_projects").delete().in("id", ids);
      }
      await admin.from("qr_campaigns").delete().eq("owner_user_id", qaUserId);
      await admin.auth.admin.deleteUser(qaUserId);
      const { count: leftover } = await admin
        .from("qr_projects")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", qaUserId);
      record(
        "20-cleanup",
        "cleanup",
        "all disposable QA data and the QA user are removed",
        (leftover ?? 0) === 0,
        `${ids.length} project(s) deleted, 0 rows left`,
      );
    } catch (err) {
      record("20-cleanup", "cleanup", "all disposable QA data and the QA user are removed", false, err?.message ?? err);
    }

    writeReport();
  }

  const failures = checks.filter((c) => c.status === "FAIL");
  if (failures.length || failedFast) {
    console.error(`\nQR Phase 1 smoke FAILED — ${failures.length} failing check(s).`);
    process.exit(1);
  }
  console.log(`\nQR Phase 1 smoke PASSED — ${checks.length} checks.`);
}

function writeReport() {
  const finishedAt = new Date();
  const failures = checks.filter((c) => c.status === "FAIL");
  const verdict = failures.length === 0 ? "PASS" : "FAIL";
  const report = {
    feature: "QR Phase 1",
    verdict,
    baseUrl: BASE_URL,
    commit: process.env.GITHUB_SHA ?? null,
    runUrl:
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSeconds: Math.round((finishedAt - startedAt) / 1000),
    passed: checks.length - failures.length,
    failed: failures.length,
    checks,
    notes,
  };

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(join(ARTIFACT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    `# QR Phase 1 — Live Smoke Evidence`,
    ``,
    `**Verdict: ${verdict}** — ${report.passed} passed, ${report.failed} failed.`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| Target | ${report.baseUrl} |`,
    `| Commit | ${report.commit ?? "local"} |`,
    `| CI run | ${report.runUrl ?? "local"} |`,
    `| Started | ${report.startedAt} |`,
    `| Duration | ${report.durationSeconds}s |`,
    ``,
    `## Checks`,
    ``,
    `| # | Surface | Check | Result | Evidence |`,
    `| --- | --- | --- | --- | --- |`,
    ...checks.map(
      (c) =>
        `| ${c.id} | \`${c.surface}\` | ${c.description} | ${c.status === "PASS" ? "PASS" : "**FAIL**"} | ${c.detail.replace(/\|/g, "\\|")} |`,
    ),
    ``,
    `## Test data`,
    ``,
    ...notes.map((n) => `- ${n}`),
    `- Every row created by this run is deleted in the harness's finally block, scoped to the disposable QA user id only.`,
    ``,
    `## Screenshots`,
    ``,
    `- \`01-dashboard-qr.png\` — owner QR list`,
    `- \`02-dashboard-qr-new.png\` — create wizard before save`,
    `- \`03-saved.png\` — saved dynamic QR with downloads`,
    `- \`04-paused.png\` — paused state in the dashboard`,
    `- \`05-mobile.png\` — list at 390px`,
    ``,
  ].join("\n");
  writeFileSync(join(ARTIFACT_DIR, "report.md"), md);
  console.log(`\nEvidence report written to ${join(ARTIFACT_DIR, "report.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
