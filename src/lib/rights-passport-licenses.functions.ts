/**
 * AurumVault License Register™ — server functions.
 *
 * Same RLS-bound-client convention as the rest of this workspace. A license
 * always references a specific asset (asset_id is NOT NULL at the DB
 * layer) — this codebase's asset-ownership guard trigger
 * (rights_workspace_guard_asset_passport) additionally verifies that asset
 * actually belongs to the same passport_key being written to.
 *
 * SAFETY: nothing here marks a license "invalid" — expiry is surfaced as a
 * computed, read-only `isExpired` flag for the UI/risk-engine to react to;
 * the stored `status` column is only ever changed by the user themselves.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  licenseUpsertSchema,
  LICENSE_COLS,
  type LicenseRow,
} from "@/lib/rights-passport-workspace.schema";

function toPatch(input: Partial<Record<string, unknown>>): Record<string, unknown> {
  const map: Record<string, string> = {
    licensee: "licensee",
    exactUse: "exact_use",
    permissionType: "permission_type",
    startDate: "start_date",
    endDate: "end_date",
    territory: "territory",
    isExclusive: "is_exclusive",
    aiSyntheticRightsIncluded: "ai_synthetic_rights_included",
    compensation: "compensation",
    controllingDocumentReference: "controlling_document_reference",
    status: "status",
    notes: "notes",
  };
  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(map)) {
    if (input[key] !== undefined) patch[column] = input[key];
  }
  return patch;
}

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

const createSchema = licenseUpsertSchema.extend({ passportKey: z.string().uuid() });

export const createLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<LicenseRow> => {
    const { supabase, userId } = context;
    const { passportKey, ...rest } = data;
    await assertOwnsPassportKey(supabase, userId, passportKey);
    const patch = toPatch(rest);

    const { data: row, error } = await (supabase.from("rights_licenses" as never) as any)
      .insert({ owner_user_id: userId, passport_key: passportKey, ...patch })
      .select(LICENSE_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't create license");
    return row;
  });

const updateSchema = licenseUpsertSchema.partial().extend({ id: z.string().uuid() });

export const updateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<LicenseRow> => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const patch = toPatch(rest);
    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await (supabase.from("rights_licenses" as never) as any)
      .update(patch)
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select(LICENSE_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("License not found");
    return row;
  });

export const listLicenses = createServerFn({ method: "GET" })
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<LicenseRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("rights_licenses" as never)
      .select(LICENSE_COLS as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as LicenseRow[];
  });
