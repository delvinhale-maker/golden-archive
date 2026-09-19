/**
 * AurumVault Rights Asset Registry™ — server functions.
 *
 * Same RLS-bound-client convention as rights-passport.functions.ts (genuine
 * owner-scoped RLS exists on this table, so context.supabase is used
 * throughout, never service-role). Every asset is additionally guarded at
 * the database layer by rights_passport_assets_guard_passport_owner_trg —
 * an asset can only ever be attached to a passport_key the caller actually
 * owns, even if application code had a bug.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRightsPassportEnabled } from "@/lib/rights-passport-feature-flags.middleware";
import { assetUpsertSchema, ASSET_COLS, type AssetRow } from "@/lib/rights-passport.schema";

function toPatch(input: Partial<Record<string, unknown>>): Record<string, unknown> {
  const map: Record<string, string> = {
    assetType: "asset_type",
    name: "name",
    description: "description",
    claimedOwnerController: "claimed_owner_controller",
    controlBasis: "control_basis",
    registrationIdentifier: "registration_identifier",
    evidenceLocation: "evidence_location",
    isPublic: "is_public",
    defaultAiPolicy: "default_ai_policy",
    defaultLicensePolicy: "default_license_policy",
    territory: "territory",
    expiryDate: "expiry_date",
    representative: "representative",
    status: "status",
    notes: "notes",
  };
  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(map)) {
    if (input[key] !== undefined) patch[column] = input[key];
  }
  return patch;
}

/**
 * Verifies the caller actually owns a passport with this passport_key
 * before touching any asset row — a friendly, specific error here backstops
 * the DB-level guard trigger, which would otherwise surface as a raw
 * Postgres exception.
 */
async function assertOwnsPassportKey(
  supabase: any,
  userId: string,
  passportKey: string,
): Promise<void> {
  const { data } = await supabase
    .from("rights_passports" as never)
    .select("id" as never)
    .eq("passport_key" as never, passportKey)
    .eq("owner_user_id" as never, userId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Passport not found");
}

const createSchema = assetUpsertSchema.extend({ passportKey: z.string().uuid() });

export const createAsset = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<AssetRow> => {
    const { supabase, userId } = context;
    const { passportKey, ...rest } = data;
    await assertOwnsPassportKey(supabase, userId, passportKey);
    const patch = toPatch(rest);

    const { data: row, error } = await (supabase.from("rights_passport_assets" as never) as any)
      .insert({
        owner_user_id: userId,
        passport_key: passportKey,
        ...patch,
      })
      .select(ASSET_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create asset");
    return row;
  });

const updateSchema = assetUpsertSchema.partial().extend({ id: z.string().uuid() });

export const updateAsset = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<AssetRow> => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const patch = toPatch(rest);
    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await (supabase.from("rights_passport_assets" as never) as any)
      .update(patch)
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select(ASSET_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Asset not found");
    return row;
  });

export const listAssets = createServerFn({ method: "GET" })
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<AssetRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("rights_passport_assets" as never)
      .select(ASSET_COLS as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as AssetRow[];
  });

/** Soft-delete: assets are archived, never hard-deleted (no DELETE grant exists on this table at all). */
export const archiveAsset = createServerFn({ method: "POST" })
  .middleware([requireRightsPassportEnabled, requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await (supabase.from("rights_passport_assets" as never) as any)
      .update({ status: "ARCHIVED" })
      .eq("id", data.id)
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
