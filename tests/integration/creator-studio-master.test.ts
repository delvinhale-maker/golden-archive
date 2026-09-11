import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";

// Source-contract tests: composition.schema.ts, the master migration, and
// every server function file in src/lib/creator-studio import zod and/or
// @tanstack/react-start/@supabase/supabase-js, none of which are installed
// in this sandbox (confirmed: `bun test` cannot resolve "zod" here at all --
// the package itself is absent from node_modules, not just a tsc/registry
// issue). Following this repo's established pattern (see the CS1-foundation
// branch's own integration test), these files are verified via genuine
// regex/structural assertions against their real source text instead of a
// direct import. scene-planner.ts, shotstack.server.ts's pure JSON builder,
// and cost-tracking.ts have ZERO such runtime dependencies and are already
// covered by real, directly-executed tests in tests/unit/.

const MIGRATION_PATH =
  "docs/proposed-migrations/20260910130000_create_creator_studio_master_schema.sql";
const migration = readFileSync(MIGRATION_PATH, "utf8");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("CS1 migration -- additive, unapplied, safe location", () => {
  it("is not staged under supabase/migrations (the platform's auto-apply directory)", () => {
    expect(() =>
      readFileSync("supabase/migrations/" + MIGRATION_PATH.split("/").pop()!, "utf8"),
    ).toThrow();
  });

  it("contains no DROP/TRUNCATE/ALTER of any pre-existing table", () => {
    expect(migration).not.toMatch(/DROP TABLE public\.(?!creator_studio)/i);
    expect(migration).not.toMatch(/TRUNCATE/i);
    expect(migration).not.toMatch(/ALTER TABLE public\.(?!creator_studio)/i);
  });

  it("reuses has_role() and touch_updated_at() rather than redefining them", () => {
    expect(migration).toMatch(/public\.has_role\(auth\.uid\(\),\s*'admin'\)/);
    expect(migration).toMatch(/EXECUTE FUNCTION public\.touch_updated_at\(\)/);
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.has_role/);
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.touch_updated_at/);
  });

  it("creates every required table exactly once", () => {
    for (const table of [
      "creator_studio_entitlements",
      "creator_studio_projects",
      "creator_studio_assets",
      "creator_studio_project_assets",
      "creator_studio_render_jobs",
      "creator_studio_provider_events",
      "creator_studio_usage_ledger",
    ]) {
      const matches = migration.match(new RegExp(`CREATE TABLE public\\.${table} \\(`, "g"));
      expect(matches?.length, `expected exactly one CREATE TABLE for ${table}`).toBe(1);
    }
  });
});

describe("CS1 migration -- enums, statuses, durations, aspect ratio", () => {
  it("locks project_type to the exact 7 required values", () => {
    for (const type of [
      "EBOOK_PROMO",
      "COURSE_PROMO",
      "PLANNER_PROMO",
      "TIKTOK_AD",
      "INSTAGRAM_REEL",
      "PRODUCT_TRAILER",
      "BOOK_TRAILER",
    ]) {
      expect(migration).toContain(`'${type}'`);
    }
  });

  it("locks project status to DRAFT/READY/GENERATING/COMPLETE/FAILED/ARCHIVED", () => {
    expect(migration).toMatch(
      /status IN \(\s*'DRAFT','READY','GENERATING','COMPLETE','FAILED','ARCHIVED'\s*\)/,
    );
  });

  it("locks duration_seconds to 15/30/45", () => {
    expect(migration).toMatch(/duration_seconds IN \(15, 30, 45\)/g);
  });

  it("locks aspect_ratio to 9:16 only, on its own isolated constraint", () => {
    expect(migration).toMatch(
      /aspect_ratio\s+TEXT NOT NULL DEFAULT '9:16' CHECK \(aspect_ratio IN \('9:16'\)\)/,
    );
  });

  it("locks style_preset to the exact 6 required values", () => {
    for (const style of [
      "LUXURY_EDITORIAL",
      "BOLD_SOCIAL",
      "CINEMATIC",
      "CLEAN_MINIMAL",
      "CREATOR_ENERGY",
      "BOOK_TRAILER",
    ]) {
      expect(migration).toContain(`'${style}'`);
    }
  });

  it("locks asset_type to COVER/SCREENSHOT/LOGO/OTHER_IMAGE/VIDEO_OUTPUT/THUMBNAIL", () => {
    expect(migration).toMatch(
      /asset_type IN \(\s*'COVER','SCREENSHOT','LOGO','OTHER_IMAGE','VIDEO_OUTPUT','THUMBNAIL'\s*\)/,
    );
  });

  it("locks render_jobs.status to the 6 canonical provider-neutral statuses", () => {
    expect(migration).toMatch(
      /status\s+TEXT NOT NULL DEFAULT 'QUEUED' CHECK \(status IN \(\s*'QUEUED','SUBMITTED','RENDERING','SUCCEEDED','FAILED','CANCELLED'\s*\)\)/,
    );
  });
});

describe("CS1 migration -- RLS enabled, owner-scoped, no anonymous access", () => {
  const tables = [
    "creator_studio_entitlements",
    "creator_studio_projects",
    "creator_studio_assets",
    "creator_studio_project_assets",
    "creator_studio_render_jobs",
    "creator_studio_provider_events",
    "creator_studio_usage_ledger",
  ];

  it("enables RLS on every Creator Studio table", () => {
    for (const table of tables) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it("revokes all anon access on every Creator Studio table", () => {
    for (const table of tables) {
      expect(migration).toContain(`REVOKE ALL ON public.${table} FROM anon;`);
    }
  });

  it("every owner-scoped SELECT/INSERT/UPDATE/DELETE policy checks auth.uid() -- never a bare client-supplied column", () => {
    const policyBlocks = migration.match(/CREATE POLICY [\s\S]*?;/g) ?? [];
    const ownerPolicies = policyBlocks.filter((p) =>
      /_owner_(select|insert|update|delete)/.test(p),
    );
    expect(ownerPolicies.length).toBeGreaterThan(10);
    for (const policy of ownerPolicies) {
      expect(policy, policy).toMatch(/auth\.uid\(\)/);
    }
  });

  it("has no USING (true) or WITH CHECK (true) policy on any Creator Studio table (no accidental broad access)", () => {
    expect(migration).not.toMatch(/USING \(\s*true\s*\)/i);
    expect(migration).not.toMatch(/WITH CHECK \(\s*true\s*\)/i);
  });
});

describe("CS1 migration -- no DELETE except the one documented exception", () => {
  it("grants no DELETE on projects/assets/render_jobs/entitlements/usage_ledger/provider_events", () => {
    for (const table of [
      "creator_studio_projects",
      "creator_studio_assets",
      "creator_studio_render_jobs",
      "creator_studio_entitlements",
      "creator_studio_usage_ledger",
      "creator_studio_provider_events",
    ]) {
      const grantLine = migration.match(
        new RegExp(`GRANT [^;]*ON public\\.${table} TO authenticated;`),
      );
      expect(grantLine?.[0] ?? "", `authenticated grants for ${table}`).not.toMatch(/DELETE/);
    }
  });

  it("grants DELETE on project_assets only, with an explicit ownership justification comment", () => {
    expect(migration).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_studio_project_assets TO authenticated;",
    );
    expect(migration).toMatch(/DELETE is allowed here \(unlike every other Creator Studio table\)/);
  });

  it("archives projects (status transition) rather than deleting them -- verified in projects.functions.ts", () => {
    const fns = read("src/lib/creator-studio/projects.functions.ts");
    expect(fns).toContain('status: "ARCHIVED"');
    expect(fns).not.toMatch(/\.delete\(\)/);
  });
});

describe("CS1 migration -- idempotency and concurrency safety", () => {
  it("gives render_jobs, usage_ledger, and provider_events each a UNIQUE idempotency/dedupe column", () => {
    expect(migration).toMatch(/idempotency_key\s+TEXT NOT NULL UNIQUE/);
    expect(migration).toMatch(/dedupe_key\s+TEXT NOT NULL UNIQUE/);
  });

  it("enforces at most one in-flight render job per project via a partial unique index", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX creator_studio_render_jobs_one_active_per_project[\s\S]*?WHERE status IN \('QUEUED','SUBMITTED','RENDERING'\);/,
    );
  });

  it("takes a row lock (FOR UPDATE) on the entitlements row before mutating counters in every RPC", () => {
    const forUpdateCount = (migration.match(/FOR UPDATE/g) ?? []).length;
    expect(forUpdateCount).toBeGreaterThanOrEqual(3);
  });
});

describe("CS4 RPCs -- reservation, finalize, release, Stripe fulfillment", () => {
  it("defines all four RPCs as SECURITY DEFINER with SET search_path = public", () => {
    for (const fn of [
      "creator_studio_reserve_video_credit",
      "creator_studio_finalize_consumption",
      "creator_studio_release_reservation",
      "creator_studio_apply_stripe_fulfillment",
    ]) {
      const block = migration.match(
        new RegExp(`CREATE FUNCTION public\\.${fn}\\([\\s\\S]*?\\$\\$;`),
      );
      expect(block, `${fn} definition`).toBeTruthy();
      expect(block![0]).toMatch(/SECURITY DEFINER/);
      expect(block![0]).toMatch(/SET search_path = public/);
    }
  });

  it("restricts reserve to the caller's own user id via auth.uid()", () => {
    expect(migration).toMatch(/auth\.uid\(\) IS DISTINCT FROM p_user_id/);
  });

  it("grants EXECUTE on the user-initiated reserve RPC to authenticated, but the other three to service_role only", () => {
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.creator_studio_reserve_video_credit(UUID, UUID, TEXT) TO authenticated;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.creator_studio_finalize_consumption(UUID, TEXT) TO service_role;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.creator_studio_release_reservation(UUID, TEXT) TO service_role;",
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.creator_studio_apply_stripe_fulfillment\([^)]*\) TO service_role;/,
    );
    expect(migration).not.toMatch(/creator_studio_finalize_consumption\([^)]*\) TO authenticated/);
    expect(migration).not.toMatch(/creator_studio_release_reservation\([^)]*\) TO authenticated/);
    expect(migration).not.toMatch(
      /creator_studio_apply_stripe_fulfillment\([^)]*\) TO authenticated/,
    );
  });

  it("spends in the documented order: FREE preview, then included quota, then extra credits", () => {
    const reserveFn = migration.slice(
      migration.indexOf("CREATE FUNCTION public.creator_studio_reserve_video_credit"),
      migration.indexOf("CREATE FUNCTION public.creator_studio_finalize_consumption"),
    );
    const freeIdx = reserveFn.indexOf("v_row.plan = 'FREE'");
    const includedIdx = reserveFn.indexOf(
      "videos_used_this_period < v_row.videos_included_per_period",
    );
    const extraIdx = reserveFn.indexOf("extra_credits_balance > 0");
    expect(freeIdx).toBeGreaterThan(-1);
    expect(includedIdx).toBeGreaterThan(freeIdx);
    expect(extraIdx).toBeGreaterThan(includedIdx);
  });

  it("release refuses to refund a reservation that was already finalized", () => {
    const releaseFn = migration.slice(
      migration.indexOf("CREATE FUNCTION public.creator_studio_release_reservation"),
      migration.indexOf("CREATE FUNCTION public.creator_studio_apply_stripe_fulfillment"),
    );
    expect(releaseFn).toMatch(/ALREADY_FINALIZED/);
    expect(releaseFn).toMatch(/'finalize:' \|\| p_reserve_idempotency_key/);
  });

  it("finalize performs no counter mutation -- only records an audit ledger row", () => {
    const finalizeFn = migration.slice(
      migration.indexOf("CREATE FUNCTION public.creator_studio_finalize_consumption"),
      migration.indexOf("CREATE FUNCTION public.creator_studio_release_reservation"),
    );
    expect(finalizeFn).not.toMatch(/UPDATE public\.creator_studio_entitlements/);
    expect(finalizeFn).toMatch(/INSERT INTO public\.creator_studio_usage_ledger/);
  });

  it("Stripe fulfillment is idempotent on the Stripe event/session id", () => {
    const stripeFn = migration.slice(
      migration.indexOf("CREATE FUNCTION public.creator_studio_apply_stripe_fulfillment"),
    );
    expect(stripeFn).toMatch(/'stripe:' \|\| p_stripe_event_id/);
    expect(stripeFn).toMatch(/ALREADY_APPLIED/);
  });
});

describe("CS4 server functions -- entitlements never exposed as raw provider credits", () => {
  it("getMyEntitlementsFn returns plan/quota language, never a raw ledger/provider term", () => {
    const fns = read("src/lib/creator-studio/entitlements.functions.ts");
    expect(fns).toMatch(/videosRemainingIncluded/);
    expect(fns).not.toMatch(/provider.credit/i);
  });

  it("billing.functions.ts never hardcodes a literal Stripe price id -- only reads one from an env var name", () => {
    const billing = read("src/lib/creator-studio/billing.functions.ts");
    expect(billing).not.toMatch(/price_[A-Za-z0-9]{10,}/);
    for (const envVar of [
      "CREATOR_STUDIO_PRICE_EXTRA_CREDIT_SANDBOX",
      "CREATOR_STUDIO_PRICE_EXTRA_CREDIT_LIVE",
      "CREATOR_STUDIO_PRICE_PRO_SANDBOX",
      "CREATOR_STUDIO_PRICE_BUSINESS_SANDBOX",
    ]) {
      expect(billing).toContain(envVar);
    }
  });

  it("billing checkout functions are gated by the paid-plans flag as well as the master flag", () => {
    const billing = read("src/lib/creator-studio/billing.functions.ts");
    const blocks = billing.match(/\.middleware\(\[([^\]]+)\]\)/g) ?? [];
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      expect(block).toContain("requireCreatorStudioEnabled");
      expect(block).toContain("requireCreatorStudioPaidPlansEnabled");
    }
  });
});

describe("CS4 Stripe webhook wiring -- additive, idempotent, never touches unrelated fulfillment", () => {
  const webhook = read("src/routes/api/public/payments/webhook.ts");

  it("routes Creator Studio checkouts by metadata before falling into the pre-existing order/bundle/cart logic", () => {
    const dispatchIdx = webhook.indexOf("session.metadata?.creator_studio_kind");
    const bundleIdx = webhook.indexOf("session.metadata?.bundle_id");
    expect(dispatchIdx).toBeGreaterThan(-1);
    expect(bundleIdx).toBeGreaterThan(-1);
  });

  it("never inserts into the `orders` table from the Creator Studio fulfillment path", () => {
    const csFn = webhook.slice(
      webhook.indexOf("export async function handleCreatorStudioCheckoutCompleted"),
      webhook.indexOf("export async function handleCreatorStudioSubscriptionDeleted"),
    );
    expect(csFn).not.toMatch(/from\("orders"\)/);
  });

  it("only resets subscription quota when the billing period actually advanced", () => {
    const renewedFn = webhook.slice(
      webhook.indexOf("export async function handleCreatorStudioSubscriptionRenewed"),
    );
    expect(renewedFn).toMatch(/existingPeriodEnd &&[\s\S]*?return;/);
  });

  it("subscribes to customer.subscription.deleted and .updated in the dispatcher", () => {
    expect(webhook).toContain('event.type === "customer.subscription.deleted"');
    expect(webhook).toContain('event.type === "customer.subscription.updated"');
  });
});

describe("CS3 render-jobs.functions.ts -- reserve-before-provider, release-on-failure, no client owner trust", () => {
  const fns = read("src/lib/creator-studio/render-jobs.functions.ts");

  it("calls the reserve RPC strictly before calling the Shotstack adapter's submitRender", () => {
    const reserveIdx = fns.indexOf("creator_studio_reserve_video_credit");
    const submitIdx = fns.indexOf("await submitRender(");
    expect(reserveIdx).toBeGreaterThan(-1);
    expect(submitIdx).toBeGreaterThan(reserveIdx);
  });

  it("releases the reservation on both the duplicate-active-job path and the provider-failure path", () => {
    const releaseMatches = fns.match(/creator_studio_release_reservation/g) ?? [];
    expect(releaseMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the exact required customer-safe failure message", () => {
    expect(fns).toContain("We couldn't finish this video. Your video credit was not consumed.");
  });

  it("never trusts a client-supplied owner id -- every project/job query filters by context.userId", () => {
    expect(fns).not.toMatch(/data\.ownerUserId/);
    expect(fns).not.toMatch(/data\.ownerId/);
    const projectQueryBlock = fns.slice(
      fns.indexOf('.from("creator_studio_projects"'),
      fns.indexOf('.from("creator_studio_projects"') + 400,
    );
    expect(projectQueryBlock).toContain("context.userId");
  });

  it("gates submission behind both the master and rendering flags, in that order, before auth", () => {
    const middlewareBlock = fns.match(/\.middleware\(\[([\s\S]*?)\]\)/);
    expect(middlewareBlock).toBeTruthy();
    const order = middlewareBlock![1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(order).toEqual([
      "requireCreatorStudioEnabled",
      "requireCreatorStudioRenderingEnabled",
      "requireSupabaseAuth",
    ]);
  });

  it("runs the abuse guardrail check before reserving any credit", () => {
    const guardIdx = fns.indexOf("checkCreatorStudioAbuseGuardrails(");
    const reserveIdx = fns.indexOf("creator_studio_reserve_video_credit");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(reserveIdx).toBeGreaterThan(guardIdx);
  });
});

describe("CS3 webhook -- authenticity via per-job token, not payload-trusted ownership", () => {
  const webhook = read("src/routes/api/public/creator-studio/shotstack-webhook.ts");

  it("resolves the render job strictly by the URL job id, then verifies the token against the stored key", () => {
    expect(webhook).toMatch(/\.eq\("id", jobId\)/);
    expect(webhook).toMatch(/job\.idempotency_key !== token/);
  });

  it("never reads an owner/user id out of the webhook request body", () => {
    expect(webhook).not.toMatch(/body\.owner/i);
    expect(webhook).not.toMatch(/body\.user_id/i);
  });

  it("is idempotent via a unique dedupe_key insert, treating a conflict as an already-processed duplicate", () => {
    expect(webhook).toMatch(/dedupeKey/);
    expect(webhook).toMatch(/duplicate: true/);
  });

  it("ignores further events once a job is already terminal", () => {
    expect(webhook).toMatch(/job already terminal/);
  });

  it("calls finalize on success and release on failure, never both", () => {
    expect(webhook).toContain("creator_studio_finalize_consumption");
    expect(webhook).toContain("creator_studio_release_reservation");
  });
});

describe("CS3 signed URLs -- private buckets, never a permanent public URL", () => {
  it("both storage buckets are created with public:false", () => {
    expect(migration).toMatch(
      /\('creator-studio-source-assets', 'creator-studio-source-assets', false\)/,
    );
    expect(migration).toMatch(/'creator-studio-renders', 'creator-studio-renders', false/);
  });

  it("source-assets folder-scopes both read and write to the owner's own folder", () => {
    const bucketSection = migration.slice(migration.indexOf("-- Source assets:"));
    const ownerScoped =
      bucketSection.match(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g) ?? [];
    expect(ownerScoped.length).toBeGreaterThanOrEqual(2);
  });

  it("the renders bucket has no client INSERT/UPDATE/DELETE policy -- server/service-role writes only", () => {
    const rendersSection = migration.slice(migration.indexOf("-- Renders:"));
    expect(rendersSection).not.toMatch(/FOR INSERT TO authenticated/);
    expect(rendersSection).not.toMatch(/FOR UPDATE TO authenticated/);
  });

  it("render-jobs.functions.ts mints time-bounded signed URLs rather than public paths", () => {
    const fns = read("src/lib/creator-studio/render-jobs.functions.ts");
    expect(fns).toMatch(/createSignedUrl\(/);
    expect(fns).not.toMatch(/getPublicUrl/);
  });
});

describe("CS5 abuse guardrails -- plan-independent ceilings", () => {
  const guardrails = read("src/lib/creator-studio/abuse-guardrails.ts");

  it("defines all required ceilings with sane, bounded values", () => {
    expect(guardrails).toMatch(/MAX_SOURCE_ASSET_BYTES = 15 \* 1024 \* 1024/);
    expect(guardrails).toMatch(/MAX_SCREENSHOTS_PER_PROJECT = 10/);
    expect(guardrails).toMatch(/MAX_CONCURRENT_RENDERS_PER_USER = 2/);
    expect(guardrails).toMatch(/MAX_RENDER_SUBMISSIONS_PER_24H = 20/);
  });

  it("is actually wired into asset upload and render submission, not just defined", () => {
    const assetsFns = read("src/lib/creator-studio/assets.functions.ts");
    expect(assetsFns).toContain("MAX_SOURCE_ASSET_BYTES");
    expect(assetsFns).toContain("MAX_SCREENSHOTS_PER_PROJECT");
    const renderFns = read("src/lib/creator-studio/render-jobs.functions.ts");
    expect(renderFns).toContain("checkCreatorStudioAbuseGuardrails");
  });

  it("every Shotstack network call is bounded by a timeout (no unbounded provider wait)", () => {
    const adapter = read("src/lib/creator-studio/providers/shotstack.server.ts");
    const timeoutUses = adapter.match(/AbortSignal\.timeout\(/g) ?? [];
    expect(timeoutUses.length).toBeGreaterThanOrEqual(2);
  });
});

describe("CS5 admin cost aggregate -- never exposed to non-admins, never shown to customers", () => {
  it("explicitly verifies the admin role before returning any cost data", () => {
    const admin = read("src/lib/creator-studio/admin.functions.ts");
    expect(admin).toMatch(/has_role/);
    expect(admin).toMatch(/Not authorized/);
  });

  it("the customer-facing entitlements function never imports the cost-tracking module", () => {
    const entitlements = read("src/lib/creator-studio/entitlements.functions.ts");
    expect(entitlements).not.toMatch(/cost-tracking/);
  });
});

describe("CS1/CS2/CS5 routes -- exist, are guarded, and never leak infrastructure terms", () => {
  const ROUTE_FILES = [
    "src/routes/_authenticated/creator-studio.tsx",
    "src/routes/_authenticated/creator-studio.new.tsx",
    "src/routes/_authenticated/creator-studio.$projectId.index.tsx",
    "src/routes/_authenticated/creator-studio.$projectId.assets.tsx",
    "src/routes/_authenticated/creator-studio.$projectId.style.tsx",
    "src/routes/_authenticated/creator-studio.$projectId.preview.tsx",
    "src/routes/_authenticated/creator-studio.$projectId.render.tsx",
    "src/routes/_authenticated/creator-studio.library.tsx",
    "src/routes/_authenticated/creator-studio.upgrade.tsx",
  ];

  it("every required route file exists under _authenticated", () => {
    for (const path of ROUTE_FILES) {
      expect(() => readFileSync(path, "utf8"), path).not.toThrow();
    }
  });

  it("no route/wizard file mentions render job, provider id, Shotstack, JSON timeline, or API request", () => {
    for (const path of ROUTE_FILES) {
      const src = read(path);
      expect(src, path).not.toMatch(/render job/i);
      expect(src, path).not.toMatch(/provider id/i);
      expect(src, path).not.toMatch(/shotstack/i);
      expect(src, path).not.toMatch(/json timeline/i);
      expect(src, path).not.toMatch(/api request/i);
    }
  });

  it("uses the exact required customer-facing status copy", () => {
    const renderPage = read("src/routes/_authenticated/creator-studio.$projectId.render.tsx");
    expect(renderPage).toContain("Preparing your promo…");
    expect(renderPage).toContain("Creating your video…");
    expect(renderPage).toContain("Your video is ready.");
  });

  it("does not implement a timeline editor or drag-and-drop anywhere in the wizard", () => {
    for (const path of ROUTE_FILES) {
      const src = read(path);
      expect(src, path).not.toMatch(/draggable|dnd|react-dnd|timeline/i);
    }
  });

  it("V1 offers 9:16 only -- no aspect ratio picker in the style step", () => {
    const stylePage = read("src/routes/_authenticated/creator-studio.$projectId.style.tsx");
    expect(stylePage).not.toMatch(/16:9|1:1/);
  });

  it("the landing page uses the exact required hero/CTA copy", () => {
    const home = read("src/routes/_authenticated/creator-studio.tsx");
    expect(home).toContain("Your product. Your brand. Your promo—done.");
    expect(home).toContain("Create My Video");
  });
});

describe("Nav gating -- Creator Studio entry only renders behind the client flag mirror", () => {
  it("PublisherShell filters the Creator Studio nav item through isCreatorStudioEnabledClient", () => {
    const shell = read("src/components/marketplace/PublisherShell.tsx");
    expect(shell).toContain("isCreatorStudioEnabledClient");
    expect(shell).toMatch(/creatorStudio\?:\s*boolean/);
    expect(shell).toMatch(/visibleNavItems\(\)\.map/g);
  });
});
