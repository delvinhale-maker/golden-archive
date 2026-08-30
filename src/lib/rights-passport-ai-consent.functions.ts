/**
 * AurumVault AI Consent Builder™ — server functions.
 *
 * Same conventions as rights-passport-assets.functions.ts: genuine
 * owner-scoped RLS exists on rights_ai_consents, so context.supabase (the
 * RLS-bound client) is used throughout, never service-role.
 *
 * SAFETY: there is no upsert path that can create a consent row without an
 * explicit `permission` value — Zod requires it (aiConsentUpsertSchema).
 * An undeclared use case simply has no row; listAiConsents' caller is
 * responsible for rendering the gap as "NOT DECLARED," never inferring
 * ALLOW from absence.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  aiConsentUpsertSchema,
  AI_CONSENT_COLS,
  type AiConsentRow,
} from "@/lib/rights-passport-workspace.schema";

function toPatch(input: Partial<Record<string, unknown>>): Record<string, unknown> {
  const map: Record<string, string> = {
    useCase: "use_case",
    permission: "permission",
    compensationRule: "compensation_rule",
    separateWrittenConsentRequired: "separate_written_consent_required",
    humanOutputApprovalRequired: "human_output_approval_required",
    attributionRequired: "attribution_required",
    modelRetentionAllowed: "model_retention_allowed",
    derivedModelAllowed: "derived_model_allowed",
    term: "term",
    territory: "territory",
    revocationRule: "revocation_rule",
    licenseContact: "license_contact",
    evidenceReference: "evidence_reference",
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

const createSchema = aiConsentUpsertSchema.extend({ passportKey: z.string().uuid() });

/**
 * Upserts a consent row for (passportKey, assetId, useCase) — the DB's
 * unique constraint on that triple means declaring the same use case twice
 * updates the existing row rather than creating a duplicate.
 */
export const upsertAiConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<AiConsentRow> => {
    const { supabase, userId } = context;
    const { passportKey, assetId, ...rest } = data;
    await assertOwnsPassportKey(supabase, userId, passportKey);
    const patch = toPatch(rest);

    const { data: row, error } = await (supabase.from("rights_ai_consents" as never) as any)
      .upsert(
        {
          owner_user_id: userId,
          passport_key: passportKey,
          asset_id: assetId ?? null,
          ...patch,
        },
        { onConflict: "passport_key,asset_id,use_case" },
      )
      .select(AI_CONSENT_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't save AI consent");
    return row;
  });

export const listAiConsents = createServerFn({ method: "GET" })
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<AiConsentRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("rights_ai_consents" as never)
      .select(AI_CONSENT_COLS as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .order("use_case" as never, { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as AiConsentRow[];
  });
