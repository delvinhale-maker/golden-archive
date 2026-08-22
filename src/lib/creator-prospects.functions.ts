import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PROSPECT_STATUSES = [
  "identified",
  "contacted",
  "replied",
  "applied",
  "approved",
  "declined",
  "not_a_fit",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export type CreatorProspect = {
  id: string;
  name: string;
  platform: string | null;
  profileUrl: string | null;
  contactEmail: string | null;
  niche: string | null;
  audienceSize: number | null;
  status: ProspectStatus;
  notes: string | null;
  lastContactedAt: string | null;
  createdAt: string;
};

const text = (max: number) => z.string().trim().max(max);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: text(120).min(1, "Name is required"),
  platform: text(60).optional().or(z.literal("")),
  profileUrl: z.string().trim().url().max(400).optional().or(z.literal("")),
  contactEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
  niche: text(120).optional().or(z.literal("")),
  audienceSize: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  status: z.enum(PROSPECT_STATUSES),
  notes: text(4000).optional().or(z.literal("")),
  lastContactedAt: z.string().datetime().nullable().optional(),
});

/** Strips control characters so stored notes can't smuggle header/markup payloads. */
function clean(value: string | undefined | null): string | null {
  if (!value) return null;
  const out = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return out.length ? out : null;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

function mapRow(r: any): CreatorProspect {
  return {
    id: r.id,
    name: r.name,
    platform: r.platform,
    profileUrl: r.profile_url,
    contactEmail: r.contact_email,
    niche: r.niche,
    audienceSize: r.audience_size,
    status: r.status,
    notes: r.notes,
    lastContactedAt: r.last_contacted_at,
    createdAt: r.created_at,
  };
}

export const listCreatorProspects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorProspect[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("creator_prospects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []).map(mapRow);
  });

export const saveCreatorProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ context, data }): Promise<CreatorProspect> => {
    await assertAdmin(context);
    const row = {
      name: clean(data.name)!,
      platform: clean(data.platform),
      profile_url: clean(data.profileUrl),
      contact_email: clean(data.contactEmail)?.toLowerCase() ?? null,
      niche: clean(data.niche),
      audience_size: data.audienceSize ?? null,
      status: data.status,
      notes: clean(data.notes),
      last_contacted_at: data.lastContactedAt ?? null,
      created_by: context.userId,
    };

    const query = data.id
      ? context.supabase.from("creator_prospects").update(row).eq("id", data.id).select("*").single()
      : context.supabase.from("creator_prospects").insert(row).select("*").single();

    const { data: saved, error } = await query;
    if (error) throw error;
    return mapRow(saved);
  });

export const deleteCreatorProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("creator_prospects").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });
