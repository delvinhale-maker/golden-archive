import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QR_NICHES, QR_USE_CASES } from "@/lib/qr-usecases";
import {
  QR_PROJECT_COLUMNS,
  assertOwnedCampaign,
  insertDynamicQrProject,
  rawFromStoredDestination,
  rollupScansByProject,
  type ScanRollup,
} from "@/lib/qr-business.server";

export type QrCampaign = {
  id: string;
  name: string;
  goal: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type QrCampaignWithStats = QrCampaign & {
  qrCount: number;
  scans: ScanRollup;
};

export type CampaignPlacement = {
  id: string;
  name: string;
  placementLabel: string | null;
  status: string;
  publicId: string;
  destination: string;
  scans: ScanRollup;
};

export type ShortcutTargets = {
  storefrontReady: boolean;
  products: { id: string; title: string }[];
};

/** Create a campaign to group QR codes by goal (e.g. "Spring Open House"). */
export const createQrCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        goal: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<QrCampaign> => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase.from("qr_campaigns" as never) as any)
      .insert({
        owner_user_id: userId,
        name: data.name,
        goal: data.goal || null,
        notes: data.notes || null,
      })
      .select("id,name,goal,notes,status,created_at,updated_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create campaign");
    return row as QrCampaign;
  });

export const listMyQrCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QrCampaignWithStats[]> => {
    const { supabase, userId } = context;
    const { data: campaigns, error } = await supabase
      .from("qr_campaigns" as never)
      .select("id,name,goal,notes,status,created_at,updated_at" as never)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (campaigns ?? []) as unknown as QrCampaign[];
    if (!rows.length) return [];

    const { data: projects } = await supabase
      .from("qr_projects" as never)
      .select("id,campaign_id" as never)
      .eq("owner_user_id" as never, userId)
      .not("campaign_id" as never, "is", null as never);

    const byCampaign = new Map<string, string[]>();
    for (const p of (projects ?? []) as unknown as { id: string; campaign_id: string }[]) {
      const list = byCampaign.get(p.campaign_id) ?? [];
      list.push(p.id);
      byCampaign.set(p.campaign_id, list);
    }

    const allIds = [...byCampaign.values()].flat();
    const rollups = await rollupScansByProject(supabase as never, allIds);

    return rows.map((c) => {
      const ids = byCampaign.get(c.id) ?? [];
      const scans = { total: 0, last7Days: 0, last30Days: 0, lastScanAt: null as string | null };
      for (const id of ids) {
        const r = rollups.get(id);
        if (!r) continue;
        scans.total += r.total;
        scans.last7Days += r.last7Days;
        scans.last30Days += r.last30Days;
        if (r.lastScanAt && (!scans.lastScanAt || r.lastScanAt > scans.lastScanAt)) {
          scans.lastScanAt = r.lastScanAt;
        }
      }
      return { ...c, qrCount: ids.length, scans };
    });
  });

export const updateQrCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        goal: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(500).optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<QrCampaign> => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.goal !== undefined) patch.goal = data.goal || null;
    if (data.notes !== undefined) patch.notes = data.notes || null;
    if (data.status !== undefined) patch.status = data.status;
    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await (supabase.from("qr_campaigns" as never) as any)
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", userId)
      .select("id,name,goal,notes,status,created_at,updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Campaign not found");
    return row as QrCampaign;
  });

/**
 * Per-placement analytics for one campaign: every QR in it, with its
 * placement label and its own scan rollup, so an owner can see that the
 * window decal outperformed the table tent.
 */
export const getCampaignPlacements = createServerFn({ method: "GET" })
  .inputValidator((input: { campaignId: string }) =>
    z.object({ campaignId: z.string().uuid() }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      data,
      context,
    }): Promise<{ campaign: QrCampaign; placements: CampaignPlacement[] }> => {
      const { supabase, userId } = context;
      const { data: campaign, error } = await supabase
        .from("qr_campaigns" as never)
        .select("id,name,goal,notes,status,created_at,updated_at" as never)
        .eq("id" as never, data.campaignId)
        .eq("owner_user_id" as never, userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!campaign) throw new Error("Campaign not found");

      const { data: projects } = await supabase
        .from("qr_projects" as never)
        .select("id,name,placement_label,status,public_id,destination" as never)
        .eq("owner_user_id" as never, userId)
        .eq("campaign_id" as never, data.campaignId)
        .order("created_at" as never, { ascending: true });

      const rows = (projects ?? []) as unknown as {
        id: string;
        name: string;
        placement_label: string | null;
        status: string;
        public_id: string;
        destination: string;
      }[];
      const rollups = await rollupScansByProject(
        supabase as never,
        rows.map((r) => r.id),
      );

      return {
        campaign: campaign as unknown as QrCampaign,
        placements: rows.map((r) => ({
          id: r.id,
          name: r.name,
          placementLabel: r.placement_label,
          status: r.status,
          publicId: r.public_id,
          destination: r.destination,
          scans: rollups.get(r.id) ?? {
            total: 0,
            last7Days: 0,
            last30Days: 0,
            lastScanAt: null,
          },
        })),
      };
    },
  );

/** What AurumVault can fill in for you: your storefront and your live products. */
export const listMyQrShortcutTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShortcutTargets> => {
    const { supabase, userId } = context;
    const { listOwnLiveProducts, resolveOwnStorefrontTarget } = await import(
      "@/lib/qr-shortcuts.server"
    );
    const products = await listOwnLiveProducts(supabase as never, userId);
    let storefrontReady = false;
    try {
      await resolveOwnStorefrontTarget(supabase as never, userId);
      storefrontReady = true;
    } catch {
      storefrontReady = false;
    }
    return { storefrontReady, products };
  });

/**
 * Create a dynamic QR pointing at the owner's OWN storefront or product. The
 * client never supplies a URL — only a product id — so this path cannot be
 * used to point a QR at an arbitrary or third-party destination.
 */
export const createQrShortcut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["storefront", "product"]),
        productId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80).optional(),
        useCase: z.enum(QR_USE_CASES).optional(),
        niche: z.enum(QR_NICHES).optional(),
        campaignId: z.string().uuid().nullable().optional(),
        placementLabel: z.string().max(80).nullable().optional(),
        foreground: z.string().optional(),
        background: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveOwnProductTarget, resolveOwnStorefrontTarget } = await import(
      "@/lib/qr-shortcuts.server"
    );

    const target =
      data.kind === "storefront"
        ? await resolveOwnStorefrontTarget(supabase as never, userId)
        : await resolveOwnProductTarget(
            supabase as never,
            userId,
            data.productId ?? "00000000-0000-0000-0000-000000000000",
          );

    return insertDynamicQrProject(supabase as never, userId, {
      name: data.name || target.suggestedName,
      destinationType: "url",
      destination: target.url,
      foreground: data.foreground,
      background: data.background,
      useCase: data.useCase ?? (data.kind === "storefront" ? "storefront" : "product"),
      niche: data.niche ?? null,
      campaignId: data.campaignId ?? null,
      placementLabel: data.placementLabel ?? null,
    });
  });

/**
 * Duplicate an owned QR code for a new placement. The copy gets its own
 * public_id (so its scans are tracked separately — that's the whole point of
 * placement tracking) and never inherits the source's identity.
 */
export const duplicateQrProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        placementLabel: z.string().max(80).nullable().optional(),
        campaignId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: source } = await supabase
      .from("qr_projects" as never)
      .select(QR_PROJECT_COLUMNS as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (!source) throw new Error("QR code not found");
    const src = source as any;
    const style = src.style ?? {};

    return insertDynamicQrProject(supabase as never, userId, {
      name: data.name || `${src.name} (copy)`.slice(0, 80),
      destinationType: src.destination_type,
      destination: rawFromStoredDestination(src.destination_type, src.destination),
      foreground: style.foreground,
      background: style.background,
      useCase: src.use_case ?? null,
      niche: src.niche ?? null,
      campaignId:
        data.campaignId !== undefined
          ? await assertOwnedCampaign(supabase as never, userId, data.campaignId)
          : src.campaign_id,
      placementLabel: data.placementLabel ?? null,
      duplicatedFrom: src.id,
    });
  });
