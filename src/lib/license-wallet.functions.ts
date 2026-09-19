/**
 * AurumVault Business Certificate & License Wallet™ — server functions.
 *
 * Every function is authenticated via `requireSupabaseAuth` and uses the
 * RLS-bound `context.supabase` client (the qr_projects / rights_passports
 * convention in this codebase), never the service role. Ownership is always
 * taken from `context.userId` and never from client input.
 *
 * Files live in the PRIVATE `license-wallet-documents` bucket under a
 * `<userId>/` prefix. No public URL is ever produced; viewing uses a
 * short-lived signed URL.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_REMINDER_OFFSETS,
  DEFAULT_WALLET_PLAN,
  LICENSE_WALLET_CATEGORIES,
  REMINDER_OFFSETS,
  WALLET_MAX_BYTES,
  WALLET_ALLOWED_MIME,
  checkDocumentQuota,
  checkLocationQuota,
  isWalletPlan,
  normalizeReminderOffsets,
  type WalletPlan,
} from "@/lib/license-wallet";


export const WALLET_BUCKET = "license-wallet-documents";
const SIGNED_URL_SECONDS = 300;

const DOC_COLS =
  "id,title,category,issuer,doc_number,issue_date,expiration_date,no_expiration,location_id,notes,file_path,file_name,file_mime,file_size_bytes,created_at,updated_at";

export type WalletDocument = {
  id: string;
  title: string;
  category: string;
  issuer: string | null;
  doc_number: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  no_expiration: boolean;
  location_id: string | null;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  file_mime: string | null;
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export type WalletLocation = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
};

/** Never leak storage paths or raw Postgres detail to the browser. */
function safeError(message: string): Error {
  const cleaned = message
    .replace(/license-wallet-documents\/?\S*/g, "the stored file")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/\S*/g, "the stored file");
  return new Error(cleaned);
}

function fail(message: string, fallback: string): never {
  throw safeError(message?.trim() ? fallback : fallback);
}

async function readPlan(supabase: any, userId: string): Promise<WalletPlan> {
  const { data, error } = await supabase
    .from("license_wallet_entitlements" as never)
    .select("plan,status" as never)
    .eq("user_id" as never, userId)
    .maybeSingle();
  if (error || !data) return DEFAULT_WALLET_PLAN;
  const row = data as unknown as { plan: string; status: string };
  if (row.status !== "active") return DEFAULT_WALLET_PLAN;
  return isWalletPlan(row.plan) ? row.plan : DEFAULT_WALLET_PLAN;
}

async function logActivity(
  supabase: any,
  userId: string,
  documentId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await supabase.from("license_wallet_activity" as never).insert({
    owner_user_id: userId,
    document_id: documentId,
    action,
    detail,
  } as never);
}

/* ------------------------------------------------------------------ reads */

export const getWalletHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const plan = await readPlan(supabase, userId);

    const [docsRes, locRes, settingsRes] = await Promise.all([
      supabase
        .from("license_wallet_documents" as never)
        .select(DOC_COLS as never)
        .eq("owner_user_id" as never, userId)
        .order("expiration_date" as never, { ascending: true, nullsFirst: false }),
      supabase
        .from("license_wallet_locations" as never)
        .select("id,name,address,notes" as never)
        .eq("owner_user_id" as never, userId)
        .order("name" as never),
      supabase
        .from("license_wallet_reminder_settings" as never)
        .select("enabled,recipient_email,offsets" as never)
        .eq("owner_user_id" as never, userId)
        .maybeSingle(),
    ]);

    if (docsRes.error) fail(docsRes.error.message, "We couldn't load your wallet right now.");

    const email = (context.claims as { email?: string })?.email ?? null;
    const settings = (settingsRes.data ?? null) as {
      enabled: boolean;
      recipient_email: string | null;
      offsets: number[] | null;
    } | null;

    return {
      plan,
      documents: (docsRes.data ?? []) as unknown as WalletDocument[],
      locations: (locRes.data ?? []) as unknown as WalletLocation[],
      reminderSettings: {
        enabled: settings?.enabled ?? true,
        recipient_email: settings?.recipient_email ?? email,
        offsets: settings
          ? normalizeReminderOffsets(settings.offsets)
          : [...DEFAULT_REMINDER_OFFSETS],
      },

      accountEmail: email,
    };
  });

export const getWalletDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: doc, error } = await supabase
      .from("license_wallet_documents" as never)
      .select(DOC_COLS as never)
      .eq("owner_user_id" as never, userId)
      .eq("id" as never, data.id)
      .maybeSingle();
    if (error) fail(error.message, "We couldn't load that document.");
    if (!doc) throw new Error("Document not found.");

    const [locRes, actRes] = await Promise.all([
      supabase
        .from("license_wallet_locations" as never)
        .select("id,name,address,notes" as never)
        .eq("owner_user_id" as never, userId)
        .order("name" as never),
      supabase
        .from("license_wallet_activity" as never)
        .select("id,action,detail,created_at" as never)
        .eq("owner_user_id" as never, userId)
        .eq("document_id" as never, data.id)
        .order("created_at" as never, { ascending: false })
        .limit(25),
    ]);

    return {
      document: doc as unknown as WalletDocument,
      locations: (locRes.data ?? []) as unknown as WalletLocation[],
      activity: (actRes.data ?? []) as unknown as {
        id: string;
        action: string;
        detail: Record<string, string | number | boolean | null>;
        created_at: string;
      }[],
    };
  });

/** Short-lived signed URL for the owner's own file. Never public. */
export const getWalletFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: doc } = await supabase
      .from("license_wallet_documents" as never)
      .select("id,file_path" as never)
      .eq("owner_user_id" as never, userId)
      .eq("id" as never, data.id)
      .maybeSingle();
    const path = (doc as unknown as { file_path: string | null } | null)?.file_path ?? null;
    if (!path) throw new Error("This document has no file attached.");
    if (!path.startsWith(`${userId}/`)) throw new Error("This file isn't available.");

    const { data: signed, error } = await supabase.storage
      .from(WALLET_BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error || !signed?.signedUrl) throw new Error("We couldn't open that file. Please try again.");
    await logActivity(supabase, userId, data.id, "FILE_VIEWED");
    return { url: signed.signedUrl as string };
  });

/* ----------------------------------------------------------------- writes */

const fileSchema = z
  .object({
    file_path: z.string().min(1),
    file_name: z.string().min(1).max(255),
    file_mime: z.enum(WALLET_ALLOWED_MIME),
    file_size_bytes: z.number().int().positive().max(WALLET_MAX_BYTES),
  })
  .nullable()
  .optional();

const docSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(LICENSE_WALLET_CATEGORIES),
  issuer: z.string().trim().max(200).nullish(),
  doc_number: z.string().trim().max(120).nullish(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  no_expiration: z.boolean().default(false),
  location_id: z.string().uuid().nullish(),
  notes: z.string().trim().max(4000).nullish(),
  file: fileSchema,
});

function normalizeDoc(input: z.infer<typeof docSchema>, userId: string) {
  if (input.file && !input.file.file_path.startsWith(`${userId}/`)) {
    throw new Error("Invalid upload location.");
  }
  const noExp = Boolean(input.no_expiration);
  return {
    title: input.title,
    category: input.category,
    issuer: input.issuer ?? null,
    doc_number: input.doc_number ?? null,
    issue_date: input.issue_date ?? null,
    expiration_date: noExp ? null : (input.expiration_date ?? null),
    no_expiration: noExp,
    location_id: input.location_id ?? null,
    notes: input.notes ?? null,
  };
}

export const createWalletDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => docSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const plan = await readPlan(supabase, userId);
    const { count } = await supabase
      .from("license_wallet_documents" as never)
      .select("id" as never, { count: "exact", head: true })
      .eq("owner_user_id" as never, userId);
    const quota = checkDocumentQuota(plan, count ?? 0);
    if (!quota.allowed) throw new Error(quota.message);

    const row = {
      ...normalizeDoc(data, userId),
      owner_user_id: userId,
      file_path: data.file?.file_path ?? null,
      file_name: data.file?.file_name ?? null,
      file_mime: data.file?.file_mime ?? null,
      file_size_bytes: data.file?.file_size_bytes ?? null,
    };
    const { data: created, error } = await supabase
      .from("license_wallet_documents" as never)
      .insert(row as never)
      .select("id" as never)
      .single();
    if (error) fail(error.message, "We couldn't save this document.");
    const id = (created as unknown as { id: string }).id;
    await logActivity(supabase, userId, id, "CREATED", { title: data.title });
    return { id };
  });

export const updateWalletDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => docSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const patch: Record<string, unknown> = normalizeDoc(data, userId);
    let replaced = false;
    if (data.file) {
      patch.file_path = data.file.file_path;
      patch.file_name = data.file.file_name;
      patch.file_mime = data.file.file_mime;
      patch.file_size_bytes = data.file.file_size_bytes;
      replaced = true;
    }

    const { data: previous } = await supabase
      .from("license_wallet_documents" as never)
      .select("file_path" as never)
      .eq("owner_user_id" as never, userId)
      .eq("id" as never, data.id)
      .maybeSingle();

    const { error } = await supabase
      .from("license_wallet_documents" as never)
      .update(patch as never)
      .eq("owner_user_id" as never, userId)
      .eq("id" as never, data.id);
    if (error) fail(error.message, "We couldn't save your changes.");

    const oldPath = (previous as unknown as { file_path: string | null } | null)?.file_path ?? null;
    if (replaced && oldPath && oldPath !== data.file?.file_path && oldPath.startsWith(`${userId}/`)) {
      await supabase.storage.from(WALLET_BUCKET).remove([oldPath]);
    }
    await logActivity(supabase, userId, data.id, replaced ? "FILE_REPLACED" : "UPDATED");
    return { ok: true };
  });

export const deleteWalletDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: doc } = await supabase
      .from("license_wallet_documents" as never)
      .select("file_path,title" as never)
      .eq("owner_user_id" as never, userId)
      .eq("id" as never, data.id)
      .maybeSingle();
    const row = (doc ?? null) as unknown as { file_path: string | null; title: string } | null;

    const { error } = await supabase
      .from("license_wallet_documents" as never)
      .delete()
      .eq("owner_user_id" as never, userId)
      .eq("id" as never, data.id);
    if (error) fail(error.message, "We couldn't delete that document.");

    if (row?.file_path && row.file_path.startsWith(`${userId}/`)) {
      await supabase.storage.from(WALLET_BUCKET).remove([row.file_path]);
    }
    await logActivity(supabase, userId, null, "DELETED", { title: row?.title ?? null });
    return { ok: true };
  });

/* -------------------------------------------------------------- locations */

export const saveWalletLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(160),
        address: z.string().trim().max(400).nullish(),
        notes: z.string().trim().max(1000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!data.id) {
      const plan = await readPlan(supabase, userId);
      const { count } = await supabase
        .from("license_wallet_locations" as never)
        .select("id" as never, { count: "exact", head: true })
        .eq("owner_user_id" as never, userId);
      const quota = checkLocationQuota(plan, count ?? 0);
      if (!quota.allowed) throw new Error(quota.message);
    }

    const payload = {
      name: data.name,
      address: data.address ?? null,
      notes: data.notes ?? null,
      owner_user_id: userId,
      ...(data.id ? { id: data.id } : {}),
    };
    const { error } = await supabase
      .from("license_wallet_locations" as never)
      .upsert(payload as never, { onConflict: "id" } as never);
    if (error) fail(error.message, "We couldn't save that location.");
    await logActivity(supabase, userId, null, "LOCATION_SAVED", { name: data.name });
    return { ok: true };
  });

export const deleteWalletLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase
      .from("license_wallet_locations" as never)
      .delete()
      .eq("owner_user_id" as never, userId)
      .eq("id" as never, data.id);
    if (error) fail(error.message, "We couldn't delete that location.");
    return { ok: true };
  });

/* --------------------------------------------------------------- settings */

export const saveWalletReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        recipient_email: z.string().trim().email().max(254).nullish(),
        offsets: z.array(z.number().int()).max(REMINDER_OFFSETS.length).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const offsets = data.offsets ? normalizeReminderOffsets(data.offsets) : [...DEFAULT_REMINDER_OFFSETS];
    const { error } = await supabase.from("license_wallet_reminder_settings" as never).upsert(
      {
        owner_user_id: userId,
        enabled: data.enabled,
        recipient_email: data.recipient_email ?? null,
        offsets,
      } as never,
      { onConflict: "owner_user_id" } as never,
    );
    if (error) fail(error.message, "We couldn't save your reminder settings.");
    await logActivity(supabase, userId, null, "REMINDER_SETTINGS_SAVED", {
      enabled: data.enabled,
      offsets,
    });
    return { ok: true };
  });