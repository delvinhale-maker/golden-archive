/**
 * Server-only helpers shared by the Phase 2 QR business server functions.
 *
 * These live outside *.functions.ts on purpose: TanStack's server-function
 * splitting removes non-serverFn module-scope runtime code from those files,
 * so every helper a handler calls must be imported, never co-located.
 */

import {
  MAX_ACTIVE_DYNAMIC_QR,
  generateQrPublicId,
  validateDestination,
  validateQrColors,
  type QrDestinationType,
} from "./qr";
import { normalizePlacementLabel, type QrNiche, type QrUseCase } from "./qr-usecases";

export const QR_PROJECT_COLUMNS =
  "id,public_id,name,mode,destination_type,destination,style,status,use_case,niche,placement_label,campaign_id,duplicated_from,created_at,updated_at";

type Client = { from: (table: string) => any };

/**
 * Reverse the normalization validateDestination applies before storage
 * ("mailto:a@b.c" -> "a@b.c"), so a duplicated row's already-validated
 * destination can be run back through the SAME validator instead of being
 * trusted or copied unchecked.
 */
export function rawFromStoredDestination(type: QrDestinationType, stored: string): string {
  if (type === "email") return stored.replace(/^mailto:/i, "");
  if (type === "tel") return stored.replace(/^tel:/i, "");
  if (type === "sms") return stored.replace(/^sms:/i, "");
  return stored;
}

/**
 * Paused codes still occupy a slot (their printed redirect still exists);
 * only archived rows free one. Server-authoritative — the dashboard's
 * remaining-slot display is informational only.
 */
export async function assertDynamicQuota(supabase: Client, userId: string): Promise<void> {
  const { count } = await supabase
    .from("qr_projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId)
    .eq("mode", "dynamic")
    .neq("status", "archived");
  if ((count ?? 0) >= MAX_ACTIVE_DYNAMIC_QR) {
    throw new Error(
      `You've reached your limit of ${MAX_ACTIVE_DYNAMIC_QR} active dynamic QR codes. Archive one to create another.`,
    );
  }
}

/** A campaign may only ever be one the caller owns (DB trigger enforces it too). */
export async function assertOwnedCampaign(
  supabase: Client,
  userId: string,
  campaignId: string | null | undefined,
): Promise<string | null> {
  if (!campaignId) return null;
  const { data } = await supabase
    .from("qr_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Campaign not found");
  return campaignId;
}

export type InsertDynamicQrInput = {
  name: string;
  destinationType: QrDestinationType;
  destination: string;
  foreground?: string;
  background?: string;
  useCase?: QrUseCase | null;
  niche?: QrNiche | null;
  campaignId?: string | null;
  placementLabel?: string | null;
  duplicatedFrom?: string | null;
};

/**
 * The single dynamic-QR insert path used by every Phase 2 creation route
 * (goal wizard, shortcuts, duplication). Quota, campaign ownership,
 * destination and color validation all happen here so no caller can skip
 * one of them.
 */
export async function insertDynamicQrProject(
  supabase: Client,
  userId: string,
  input: InsertDynamicQrInput,
) {
  if (input.destinationType === "text") {
    throw new Error("Plain text can only be used for a static QR code.");
  }
  const dest = validateDestination(input.destinationType, input.destination);
  if (!dest.ok) throw new Error(dest.reason);
  const colors = validateQrColors(input.foreground, input.background);
  if (!colors.ok) throw new Error(colors.reason);

  const name = (input.name ?? "").trim();
  if (!name) throw new Error("Give your QR code a name.");

  await assertDynamicQuota(supabase, userId);
  const campaignId = await assertOwnedCampaign(supabase, userId, input.campaignId);

  const { data: row, error } = await supabase
    .from("qr_projects")
    .insert({
      owner_user_id: userId,
      public_id: generateQrPublicId(),
      name: name.slice(0, 80),
      mode: "dynamic",
      destination_type: input.destinationType,
      destination: dest.payload,
      style: { foreground: colors.foreground, background: colors.background },
      status: "active",
      use_case: input.useCase ?? null,
      niche: input.niche ?? null,
      placement_label: normalizePlacementLabel(input.placementLabel),
      campaign_id: campaignId,
      duplicated_from: input.duplicatedFrom ?? null,
    })
    .select(QR_PROJECT_COLUMNS)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Couldn't create QR code");
  return row;
}

export type ScanRollup = {
  total: number;
  last7Days: number;
  last30Days: number;
  lastScanAt: string | null;
};

export function emptyRollup(): ScanRollup {
  return { total: 0, last7Days: 0, last30Days: 0, lastScanAt: null };
}

/**
 * One query for many projects, rolled up in memory — placement tracking means
 * a campaign can hold a dozen QR codes, and an N+1 COUNT per placement would
 * make the analytics page quadratic in placements.
 */
export async function rollupScansByProject(
  supabase: Client,
  projectIds: string[],
): Promise<Map<string, ScanRollup>> {
  const out = new Map<string, ScanRollup>();
  for (const id of projectIds) out.set(id, emptyRollup());
  if (!projectIds.length) return out;

  const { data } = await supabase
    .from("qr_scan_events")
    .select("qr_project_id,created_at")
    .in("qr_project_id", projectIds);

  const now = Date.now();
  const d7 = now - 7 * 86_400_000;
  const d30 = now - 30 * 86_400_000;

  for (const e of (data ?? []) as { qr_project_id: string; created_at: string }[]) {
    const roll = out.get(e.qr_project_id);
    if (!roll) continue;
    const t = new Date(e.created_at).getTime();
    roll.total += 1;
    if (t >= d7) roll.last7Days += 1;
    if (t >= d30) roll.last30Days += 1;
    if (!roll.lastScanAt || t > new Date(roll.lastScanAt).getTime()) roll.lastScanAt = e.created_at;
  }
  return out;
}
