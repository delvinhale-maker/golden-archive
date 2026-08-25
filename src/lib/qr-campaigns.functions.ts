/**
 * AurumVault QR Business System — Phase 2 campaign CRUD + analytics.
 *
 * A campaign is a lightweight grouping of the owner's own qr_projects rows
 * (e.g. "Open House — 123 Main Street" grouping a Front Door / Flyer /
 * Instagram QR). Same owner-derivation and double-scoping conventions as
 * qr.functions.ts: owner_user_id always comes from context.userId, never
 * client input, and every mutation is scoped by both id and owner_user_id
 * even though RLS (and, for cross-table attachment, a guard trigger) also
 * enforces this at the database layer.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QR_NICHE_IDS } from "@/lib/qr-niches";

const nicheSchema = z.enum(QR_NICHE_IDS).nullable().optional();
const QR_CAMPAIGN_COLS = "id,name,niche,created_at,updated_at";

export const createQrCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        niche: nicheSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase.from("qr_campaigns" as never) as any)
      .insert({ owner_user_id: userId, name: data.name.trim(), niche: data.niche ?? null })
      .select(QR_CAMPAIGN_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create campaign");
    return row;
  });

export const updateQrCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        niche: nicheSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.niche !== undefined) patch.niche = data.niche;
    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await (supabase.from("qr_campaigns" as never) as any)
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", userId)
      .select(QR_CAMPAIGN_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Campaign not found");
    return row;
  });

export type QrCampaignListItem = {
  id: string;
  name: string;
  niche: string | null;
  created_at: string;
  updated_at: string;
  qrCount: number;
  totalScans: number;
};

/**
 * The owner's campaigns with a batched project/scan count — one query per
 * table, not N+1 per campaign, matching listMyQrProjects' convention.
 */
export const listMyQrCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QrCampaignListItem[]> => {
    const { supabase, userId } = context;
    const { data: campaigns, error } = await supabase
      .from("qr_campaigns" as never)
      .select(QR_CAMPAIGN_COLS as never)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (campaigns ?? []) as unknown as Omit<QrCampaignListItem, "qrCount" | "totalScans">[];
    if (!rows.length) return [];

    const campaignIds = rows.map((r) => r.id);
    const { data: projects } = await supabase
      .from("qr_projects" as never)
      .select("id,campaign_id" as never)
      .eq("owner_user_id" as never, userId)
      .in("campaign_id" as never, campaignIds as never);
    const projectRows = (projects ?? []) as unknown as { id: string; campaign_id: string }[];

    const qrCountByCampaign = new Map<string, number>();
    const projectIdsByCampaign = new Map<string, string[]>();
    for (const p of projectRows) {
      qrCountByCampaign.set(p.campaign_id, (qrCountByCampaign.get(p.campaign_id) ?? 0) + 1);
      const list = projectIdsByCampaign.get(p.campaign_id) ?? [];
      list.push(p.id);
      projectIdsByCampaign.set(p.campaign_id, list);
    }

    const allProjectIds = projectRows.map((p) => p.id);
    const scanCountByProject = new Map<string, number>();
    if (allProjectIds.length) {
      const { data: events } = await supabase
        .from("qr_scan_events" as never)
        .select("qr_project_id" as never)
        .in("qr_project_id" as never, allProjectIds as never);
      for (const e of (events ?? []) as unknown as { qr_project_id: string }[]) {
        scanCountByProject.set(e.qr_project_id, (scanCountByProject.get(e.qr_project_id) ?? 0) + 1);
      }
    }

    return rows.map((r) => {
      const projectIds = projectIdsByCampaign.get(r.id) ?? [];
      const totalScans = projectIds.reduce((sum, id) => sum + (scanCountByProject.get(id) ?? 0), 0);
      return { ...r, qrCount: qrCountByCampaign.get(r.id) ?? 0, totalScans };
    });
  });

export const getMyQrCampaign = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("qr_campaigns" as never)
      .select(QR_CAMPAIGN_COLS as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Campaign not found");
    return row;
  });

export type QrCampaignPlacementStat = {
  qrProjectId: string;
  name: string;
  placementLabel: string | null;
  publicId: string;
  scans: number;
};

export type QrCampaignAnalytics = {
  totalScans: number;
  placements: QrCampaignPlacementStat[];
  topQr: QrCampaignPlacementStat | null;
  scansLast7Days: number;
  scansLast30Days: number;
};

/**
 * "Which placement performs best?" (Phase 2 Section 17/25) — per-QR scan
 * counts within one campaign, sorted highest-first, plus a simple 7/30-day
 * trend. Ownership is re-verified on both the campaign and every project
 * row it aggregates — a project can never be double-counted under a
 * campaign it doesn't actually belong to.
 */
export const getQrCampaignAnalytics = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<QrCampaignAnalytics> => {
    const { supabase, userId } = context;
    const { data: campaign } = await supabase
      .from("qr_campaigns" as never)
      .select("id" as never)
      .eq("id" as never, data.id)
      .eq("owner_user_id" as never, userId)
      .maybeSingle();
    if (!campaign) throw new Error("Campaign not found");

    const { data: projects } = await supabase
      .from("qr_projects" as never)
      .select("id,name,public_id,placement_label" as never)
      .eq("owner_user_id" as never, userId)
      .eq("campaign_id" as never, data.id);
    const projectRows = (projects ?? []) as unknown as {
      id: string;
      name: string;
      public_id: string;
      placement_label: string | null;
    }[];
    if (!projectRows.length) {
      return { totalScans: 0, placements: [], topQr: null, scansLast7Days: 0, scansLast30Days: 0 };
    }

    const projectIds = projectRows.map((p) => p.id);
    const { data: events } = await supabase
      .from("qr_scan_events" as never)
      .select("qr_project_id,created_at" as never)
      .in("qr_project_id" as never, projectIds as never);
    const eventRows = (events ?? []) as unknown as { qr_project_id: string; created_at: string }[];

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const countByProject = new Map<string, number>();
    let scansLast7Days = 0;
    let scansLast30Days = 0;
    for (const e of eventRows) {
      countByProject.set(e.qr_project_id, (countByProject.get(e.qr_project_id) ?? 0) + 1);
      const age = now - new Date(e.created_at).getTime();
      if (age <= 7 * DAY) scansLast7Days++;
      if (age <= 30 * DAY) scansLast30Days++;
    }

    const placements: QrCampaignPlacementStat[] = projectRows
      .map((p) => ({
        qrProjectId: p.id,
        name: p.name,
        placementLabel: p.placement_label,
        publicId: p.public_id,
        scans: countByProject.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.scans - a.scans);

    return {
      totalScans: eventRows.length,
      placements,
      topQr: placements[0] ?? null,
      scansLast7Days,
      scansLast30Days,
    };
  });
