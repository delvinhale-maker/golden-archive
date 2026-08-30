/**
 * AurumVault Provenance & Evidence Register™ — server functions.
 *
 * Same RLS-bound-client convention as the rest of this workspace. Evidence
 * always references a specific asset (asset_id NOT NULL at the DB layer),
 * guarded the same way licenses are.
 *
 * SAFETY: nothing here computes or returns an "ownership confirmed" value.
 * EVIDENCE_DISCLAIMER (rights-passport-workspace.schema.ts) must be
 * rendered by every screen that lists evidence.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  evidenceUpsertSchema,
  EVIDENCE_COLS,
  type EvidenceRow,
} from "@/lib/rights-passport-workspace.schema";

function toPatch(input: Partial<Record<string, unknown>>): Record<string, unknown> {
  const map: Record<string, string> = {
    evidenceType: "evidence_type",
    sourceCreator: "source_creator",
    issuedDate: "issued_date",
    fileUrl: "file_url",
    hashFingerprint: "hash_fingerprint",
    hasContentCredential: "has_content_credential",
    credentialManifestReference: "credential_manifest_reference",
    copyrightTrademarkReference: "copyright_trademark_reference",
    identityEvidenceReference: "identity_evidence_reference",
    verifiedBy: "verified_by",
    verificationDate: "verification_date",
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

const createSchema = evidenceUpsertSchema.extend({ passportKey: z.string().uuid() });

export const createEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<EvidenceRow> => {
    const { supabase, userId } = context;
    const { passportKey, ...rest } = data;
    await assertOwnsPassportKey(supabase, userId, passportKey);
    const patch = toPatch(rest);

    const { data: row, error } = await (supabase.from("rights_evidence" as never) as any)
      .insert({ owner_user_id: userId, passport_key: passportKey, ...patch })
      .select(EVIDENCE_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Couldn't add evidence");
    return row;
  });

const updateSchema = evidenceUpsertSchema.partial().extend({ id: z.string().uuid() });

export const updateEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<EvidenceRow> => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const patch = toPatch(rest);
    if (!Object.keys(patch).length) throw new Error("Nothing to update");

    const { data: row, error } = await (supabase.from("rights_evidence" as never) as any)
      .update(patch)
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select(EVIDENCE_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Evidence not found");
    return row;
  });

export const listEvidence = createServerFn({ method: "GET" })
  .inputValidator((input: { passportKey: string }) =>
    z.object({ passportKey: z.string().uuid() }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<EvidenceRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("rights_evidence" as never)
      .select(EVIDENCE_COLS as never)
      .eq("passport_key" as never, data.passportKey)
      .eq("owner_user_id" as never, userId)
      .order("created_at" as never, { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as EvidenceRow[];
  });
