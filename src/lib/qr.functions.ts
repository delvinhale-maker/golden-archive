import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import QRCode from "qrcode";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  QR_DESTINATION_TYPES,
  MAX_ACTIVE_DYNAMIC_QR,
  validateDestination,
  validateQrColors,
  generateQrPublicId,
  buildDynamicQrUrl,
  resolveQrSizePx,
  type QrDestinationType,
} from "@/lib/qr";
import { QR_USE_CASE_IDS } from "@/lib/qr-use-cases";
import { QR_NICHE_IDS } from "@/lib/qr-niches";

const destinationTypeSchema = z.enum(QR_DESTINATION_TYPES);
const formatSchema = z.enum(["png", "svg"]);
const sizeSchema = z.enum(["small", "standard", "print"]).optional();
// Phase 2 metadata is optional and additive everywhere it's accepted —
// omitting it preserves exact Phase 1 behavior (no use_case/niche/campaign
// classification at all).
const useCaseSchema = z.enum(QR_USE_CASE_IDS).nullable().optional();
const nicheSchema = z.enum(QR_NICHE_IDS).nullable().optional();
const campaignIdSchema = z.string().uuid().nullable().optional();
const placementLabelSchema = z.string().trim().max(60).nullable().optional();

const QR_PROJECT_COLS =
  "id,public_id,name,mode,destination_type,destination,style,status,use_case,niche,campaign_id,placement_label,created_at,updated_at";

/**
 * Verify a campaign_id (if provided) actually belongs to this owner before
 * attaching a QR project to it — a friendly, specific error here backstops
 * the DB-level qr_projects_guard_campaign_owner_trg trigger (Phase 2
 * migration), which would otherwise surface as a raw Postgres exception.
 */
async function assertOwnsCampaign(
  supabase: any,
  userId: string,
  campaignId: string | null | undefined,
): Promise<void> {
  if (!campaignId) return;
  const { data: campaign } = await supabase
    .from("qr_campaigns" as never)
    .select("id" as never)
    .eq("id" as never, campaignId)
    .eq("owner_user_id" as never, userId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found");
}

export type QrRenderResult = { format: "png"; data: string } | { format: "svg"; data: string };

/**
 * The one authoritative QR-encoding path. Renders on demand — Phase 1 never
 * persists a generated image (Section 17): the caller downloads it directly.
 * error-correction is fixed at "M" (15% recovery), a safe default given
 * Phase 1 doesn't yet support center-logo composition (which would need a
 * higher level); margin is fixed at the library's quiet-zone default (4
 * modules), never reducible by the caller, per Section 19.
 */
async function renderQrImage(
  payload: string,
  input: { format: "png" | "svg"; size?: string; foreground?: string; background?: string },
): Promise<QrRenderResult> {
  const colors = validateQrColors(input.foreground, input.background);
  if (!colors.ok) throw new Error(colors.reason);
  const width = resolveQrSizePx(input.size);

  const opts = {
    errorCorrectionLevel: "M" as const,
    margin: 4,
    width,
    color: { dark: colors.foreground, light: colors.background },
  };

  if (input.format === "svg") {
    const svg = await QRCode.toString(payload, { ...opts, type: "svg" });
    return { format: "svg", data: svg };
  }
  const dataUrl = await QRCode.toDataURL(payload, opts);
  return { format: "png", data: dataUrl };
}

/**
 * Unsaved static QR preview/download. Requires auth per the Phase 1
 * authorization (no anonymous QR creation yet) but creates no qr_projects
 * row — the destination is validated and encoded directly, never an
 * AurumVault /q/ redirect.
 */
export const generateStaticQrImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        destinationType: destinationTypeSchema,
        destination: z.string().min(1).max(2000),
        format: formatSchema,
        size: sizeSchema,
        foreground: z.string().optional(),
        background: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<QrRenderResult> => {
    const dest = validateDestination(data.destinationType, data.destination);
    if (!dest.ok) throw new Error(dest.reason);
    return renderQrImage(dest.payload, data);
  });

/**
 * Create a dynamic QR project. Ownership and the public_id are both
 * server-derived — never accepted from client input. The active-dynamic
 * limit is enforced here, server-side, so the client display of remaining
 * slots is informational only and cannot be bypassed by calling this
 * function directly.
 */
export const createQrProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        destinationType: destinationTypeSchema,
        destination: z.string().min(1).max(2000),
        foreground: z.string().optional(),
        background: z.string().optional(),
        useCase: useCaseSchema,
        niche: nicheSchema,
        campaignId: campaignIdSchema,
        placementLabel: placementLabelSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // "text" has no browser action to redirect to — it's a static-only
    // destination type. A dynamic QR must always resolve to something a
    // redirect Location header can point at.
    if (data.destinationType === "text") {
      throw new Error("Plain text can only be used for a static QR code.");
    }
    const dest = validateDestination(data.destinationType, data.destination);
    if (!dest.ok) throw new Error(dest.reason);
    const colors = validateQrColors(data.foreground, data.background);
    if (!colors.ok) throw new Error(colors.reason);

    const { supabase, userId } = context;

    await assertOwnsCampaign(supabase, userId, data.campaignId);

    // Paused codes still count against the allowance (Section 15): their
    // redirect infrastructure — and public_id — still exists and is still
    // printable. Only archived rows are excluded. Every Phase 2 creation
    // path (campaigns, duplication, shortcuts) routes through this same
    // function, so the limit has exactly one enforcement point — no bypass.
    const { count } = await supabase
      .from("qr_projects" as never)
      .select("id", { count: "exact", head: true } as never)
      .eq("owner_user_id" as never, userId)
      .eq("mode" as never, "dynamic")
      .neq("status" as never, "archived");
    if ((count ?? 0) >= MAX_ACTIVE_DYNAMIC_QR) {
      throw new Error(
        `You're using ${MAX_ACTIVE_DYNAMIC_QR} of ${MAX_ACTIVE_DYNAMIC_QR} active dynamic QR codes.`,
      );
    }

    const publicId = generateQrPublicId();
    const { data: row, error } = await (supabase.from("qr_projects" as never) as any)
      .insert({
        owner_user_id: userId,
        public_id: publicId,
        name: data.name.trim(),
        mode: "dynamic",
        destination_type: data.destinationType,
        destination: dest.payload,
        style: { foreground: colors.foreground, background: colors.background },
        status: "active",
        use_case: data.useCase ?? null,
        niche: data.niche ?? null,
        campaign_id: data.campaignId ?? null,
        placement_label: data.placementLabel?.trim() || null,
      })
      .select(QR_PROJECT_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create QR code");
    return row;
  });

const projectUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  destinationType: destinationTypeSchema.optional(),
  destination: z.string().min(1).max(2000).optional(),
  foreground: z.string().optional(),
  background: z.string().optional(),
  status: z.enum(["active", "paused"]).optional(),
  useCase: useCaseSchema,
  niche: nicheSchema,
  campaignId: campaignIdSchema,
  placementLabel: placementLabelSchema,
});

/**
 * Update a dynamic QR project's editable fields. Ownership is re-derived
 * from the authenticated context and enforced in the WHERE clause (not just
 * relied on via RLS alone) — every mutation is scoped by both the row id
 * and owner_user_id, matching the double-scoping convention already used by
 * saveMyStorefrontProfile elsewhere in this codebase. public_id is never
 * accepted as an input field at all — it cannot be changed through this
 * function even in principle, and the qr_projects_guard_identity_trg
 * trigger blocks it at the database layer too, as defense in depth.
 */
export const updateQrProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => projectUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};

    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.status !== undefined) patch.status = data.status;

    if (data.destinationType !== undefined || data.destination !== undefined) {
      if (data.destinationType === undefined || data.destination === undefined) {
        throw new Error("destinationType and destination must be updated together");
      }
      if (data.destinationType === "text") {
        throw new Error("Plain text can only be used for a static QR code.");
      }
      const dest = validateDestination(data.destinationType, data.destination);
      if (!dest.ok) throw new Error(dest.reason);
      patch.destination_type = data.destinationType;
      patch.destination = dest.payload;
    }

    if (data.foreground !== undefined || data.background !== undefined) {
      const colors = validateQrColors(data.foreground, data.background);
      if (!colors.ok) throw new Error(colors.reason);
      patch.style = { foreground: colors.foreground, background: colors.background };
    }

    if (data.useCase !== undefined) patch.use_case = data.useCase;
    if (data.niche !== undefined) patch.niche = data.niche;
    if (data.placementLabel !== undefined) patch.placement_label = data.placementLabel?.trim() || null;
    if (data.campaignId !== undefined) {
      await assertOwnsCampaign(supabase, userId, data.campaignId);
      patch.campaign_id = data.campaignId;
    }

    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await (supabase.from("qr_projects" as never) as any)
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", userId)
      .select(QR_PROJECT_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("QR code not found");
    return row;
  });

export const archiveQrProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase.from("qr_projects" as never) as any)
      .update({ status: "archived" })
      .eq("id", data.id)
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type QrProjectListItem = {
  id: string;
  public_id: string;
  name: string;
  mode: string;
  destination_type: string;
  destination: string;
  style: { foreground?: string; background?: string };
  status: string;
  use_case: string | null;
  niche: string | null;
  campaign_id: string | null;
  placement_label: string | null;
  created_at: string;
  updated_at: string;
  scanCount: number;
};

/**
 * The authenticated owner's own QR codes with a batched scan-count lookup —
 * one query per table, not one COUNT per project (Section 14's "don't
 * perform expensive COUNT(*) on every scan" is about the redirect path;
 * this listing path still shouldn't be N+1).
 */
export const listMyQrProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QrProjectListItem[]> => {
    const { supabase, userId } = context;
    const { data: projects, error } = await supabase
      .from("qr_projects" as never)
      .select(QR_PROJECT_COLS as never)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (projects ?? []) as unknown as Omit<QrProjectListItem, "scanCount">[];
    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const { data: events } = await supabase
      .from("qr_scan_events" as never)
      .select("qr_project_id" as never)
      .in("qr_project_id" as never, ids as never);
    const counts = new Map<string, number>();
    for (const e of (events ?? []) as unknown as { qr_project_id: string }[]) {
      counts.set(e.qr_project_id, (counts.get(e.qr_project_id) ?? 0) + 1);
    }

    return rows.map((r) => ({ ...r, scanCount: counts.get(r.id) ?? 0 }));
  });

export const getMyQrProject = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("qr_projects" as never)
      .select(QR_PROJECT_COLS as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("QR code not found");

    const { count } = await supabase
      .from("qr_scan_events" as never)
      .select("id", { count: "exact", head: true } as never)
      .eq("qr_project_id" as never, data.id);

    const { data: last } = await supabase
      .from("qr_scan_events" as never)
      .select("created_at" as never)
      .eq("qr_project_id" as never, data.id)
      .order("created_at" as never, { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ...(row as any),
      scanCount: count ?? 0,
      lastScanAt: (last as any)?.created_at ?? null,
    };
  });

/**
 * Render a saved dynamic project's QR image. The encoded payload is always
 * derived server-side from the owned row's public_id (buildDynamicQrUrl) —
 * never accepted as a client-supplied destination string — so this can only
 * ever produce a QR that points at AurumVault's own redirect for a project
 * the caller actually owns.
 */
export const renderQrProjectImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        format: formatSchema,
        size: sizeSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<QrRenderResult> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("qr_projects" as never)
      .select("public_id,style" as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (!row) throw new Error("QR code not found");
    const style = (row as any).style ?? {};
    return renderQrImage(buildDynamicQrUrl((row as any).public_id), {
      format: data.format,
      size: data.size,
      foreground: style.foreground,
      background: style.background,
    });
  });

/**
 * Duplicate an owned QR project for placement tracking (Phase 2 Section
 * 26) — e.g. "Open House Flyer" → "Open House Front Door". Copies
 * destination, style, use case, niche, and campaign; always generates a
 * brand-new id and public_id (never reuses the source's), and goes through
 * the exact same active-dynamic-limit check as createQrProject since it
 * ultimately creates one more dynamic row.
 */
export const duplicateQrProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        placementLabel: placementLabelSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: source, error: sourceErr } = await supabase
      .from("qr_projects" as never)
      .select(QR_PROJECT_COLS as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (sourceErr) throw new Error(sourceErr.message);
    if (!source) throw new Error("QR code not found");
    const src = source as any;

    const { count } = await supabase
      .from("qr_projects" as never)
      .select("id", { count: "exact", head: true } as never)
      .eq("owner_user_id" as never, userId)
      .eq("mode" as never, "dynamic")
      .neq("status" as never, "archived");
    if ((count ?? 0) >= MAX_ACTIVE_DYNAMIC_QR) {
      throw new Error(
        `You're using ${MAX_ACTIVE_DYNAMIC_QR} of ${MAX_ACTIVE_DYNAMIC_QR} active dynamic QR codes.`,
      );
    }

    const publicId = generateQrPublicId();
    const { data: row, error } = await (supabase.from("qr_projects" as never) as any)
      .insert({
        owner_user_id: userId,
        public_id: publicId,
        name: data.name.trim(),
        mode: "dynamic",
        destination_type: src.destination_type,
        destination: src.destination,
        style: src.style ?? {},
        status: "active",
        use_case: src.use_case ?? null,
        niche: src.niche ?? null,
        campaign_id: src.campaign_id ?? null,
        placement_label: data.placementLabel?.trim() || null,
      })
      .select(QR_PROJECT_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't duplicate QR code");
    return row;
  });

function countInRange(
  rows: { created_at: string }[],
  sinceMs: number,
): number {
  return rows.filter((r) => new Date(r.created_at).getTime() >= sinceMs).length;
}

/**
 * Modest scan analytics for one owned QR project (Phase 2 Section 15):
 * total, today, last 7/30 days, and the timestamp of the most recent scan.
 * No IP, geo, or fingerprinting — qr_scan_events never stored any of that
 * to begin with. Fetches raw timestamps once and buckets them in memory
 * rather than four separate COUNT queries; scan volume per QR is expected
 * to stay small enough that this is cheap.
 */
export const getQrProjectAnalytics = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase
      .from("qr_projects" as never)
      .select("id" as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (!owned) throw new Error("QR code not found");

    const { data: events } = await supabase
      .from("qr_scan_events" as never)
      .select("created_at" as never)
      .eq("qr_project_id" as never, data.id)
      .order("created_at" as never, { ascending: false });
    const rows = (events ?? []) as unknown as { created_at: string }[];

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    return {
      totalScans: rows.length,
      scansToday: countInRange(rows, now - (now % DAY)),
      scansLast7Days: countInRange(rows, now - 7 * DAY),
      scansLast30Days: countInRange(rows, now - 30 * DAY),
      lastScanAt: rows[0]?.created_at ?? null,
    };
  });

export type { QrDestinationType };
