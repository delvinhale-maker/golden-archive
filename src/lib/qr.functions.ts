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
import { QR_NICHES, QR_USE_CASES, normalizePlacementLabel } from "@/lib/qr-usecases";
import {
  QR_PROJECT_COLUMNS,
  assertOwnedCampaign,
} from "@/lib/qr-business.server";

const destinationTypeSchema = z.enum(QR_DESTINATION_TYPES);
const formatSchema = z.enum(["png", "svg"]);
const sizeSchema = z.enum(["small", "standard", "print"]).optional();

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
        // Phase 2 (all optional — Phase 1 callers keep working unchanged).
        useCase: z.enum(QR_USE_CASES).optional(),
        niche: z.enum(QR_NICHES).optional(),
        campaignId: z.string().uuid().nullable().optional(),
        placementLabel: z.string().max(80).nullable().optional(),
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

    // Paused codes still count against the allowance (Section 15): their
    // redirect infrastructure — and public_id — still exists and is still
    // printable. Only archived rows are excluded.
    const { count } = await supabase
      .from("qr_projects" as never)
      .select("id", { count: "exact", head: true } as never)
      .eq("owner_user_id" as never, userId)
      .eq("mode" as never, "dynamic")
      .neq("status" as never, "archived");
    if ((count ?? 0) >= MAX_ACTIVE_DYNAMIC_QR) {
      throw new Error(
        `You've reached your limit of ${MAX_ACTIVE_DYNAMIC_QR} active dynamic QR codes. Archive one to create another.`,
      );
    }

    // A campaign must be one the caller owns; the DB trigger enforces this
    // too, so a forged campaign_id can never cross owners.
    const campaignId = await assertOwnedCampaign(supabase as never, userId, data.campaignId);

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
        placement_label: normalizePlacementLabel(data.placementLabel),
        campaign_id: campaignId,
      })
      .select(QR_PROJECT_COLUMNS)
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
  // Phase 2 — placement label and campaign assignment are editable.
  placementLabel: z.string().max(80).nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
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
    if (data.placementLabel !== undefined) {
      patch.placement_label = normalizePlacementLabel(data.placementLabel);
    }
    if (data.campaignId !== undefined) {
      patch.campaign_id = await assertOwnedCampaign(supabase as never, userId, data.campaignId);
    }

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

    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await (supabase.from("qr_projects" as never) as any)
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", userId)
      .select(QR_PROJECT_COLUMNS)
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
  placement_label: string | null;
  campaign_id: string | null;
  duplicated_from: string | null;
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
      .select(
        QR_PROJECT_COLUMNS as never,
      )
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
      .select(
        QR_PROJECT_COLUMNS as never,
      )
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

export type { QrDestinationType };
