import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insiderSlug, isValidAudience, type AudienceType } from "@/lib/insider";

export interface InsiderEdition {
  id: string;
  slug: string;
  title: string;
  subject: string;
  preview_text: string | null;
  body_md: string;
  audience_type: string;
  status: string;
  is_public: boolean;
  published_at: string | null;
  sent_at: string | null;
  recipients_count: number;
  created_at: string;
}

/** Public archive list — only published/sent public editions. */
export const listPublicEditions = createServerFn({ method: "GET" }).handler(async () => {
  const { publicClient } = await import("@/lib/insider-public.server");
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("insider_editions")
    .select("slug,title,preview_text,published_at")
    .eq("is_public", true)
    .in("status", ["published", "sent"])
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) return { editions: [] as Array<Record<string, any>> };
  return { editions: data ?? [] };
});

export const getPublicEdition = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 120) }))
  .handler(async ({ data }) => {
    const { publicClient } = await import("@/lib/insider-public.server");
    const supabase = publicClient();
    const { data: row } = await supabase
      .from("insider_editions")
      .select("slug,title,preview_text,body_md,published_at")
      .eq("slug", data.slug)
      .eq("is_public", true)
      .in("status", ["published", "sent"])
      .maybeSingle();
    return { edition: (row as Record<string, any> | null) ?? null };
  });

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export interface InsiderStats {
  totalActive: number;
  pending: number;
  unsubscribed: number;
  new7: number;
  new30: number;
  byAudience: Record<string, number>;
  topSource: string | null;
  bySource: Array<{ source: string; count: number }>;
  welcomeSent: number;
  recent: Array<{ created_at: string; audience_type: string; source: string; status: string }>;
}

/** Admin-only funnel metrics. Never returns subscriber email addresses. */
export const getInsiderStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InsiderStats> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("subscribers")
      .select("created_at,status,audience_type,source,welcome_sent_at,unsubscribed_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    const list = (rows ?? []) as Array<Record<string, any>>;
    const now = Date.now();
    const days = (n: number) => now - n * 24 * 60 * 60 * 1000;

    const byAudience: Record<string, number> = { GENERAL: 0, CREATOR: 0, BUSINESS_TOOL: 0 };
    const sourceCounts = new Map<string, number>();
    let totalActive = 0;
    let pending = 0;
    let unsubscribed = 0;
    let new7 = 0;
    let new30 = 0;
    let welcomeSent = 0;

    for (const r of list) {
      const created = new Date(r.created_at).getTime();
      if (r.status === "confirmed" && !r.unsubscribed_at) {
        totalActive += 1;
        byAudience[r.audience_type ?? "GENERAL"] =
          (byAudience[r.audience_type ?? "GENERAL"] ?? 0) + 1;
      }
      if (r.status === "pending") pending += 1;
      if (r.unsubscribed_at || r.status === "unsubscribed") unsubscribed += 1;
      if (created >= days(7)) new7 += 1;
      if (created >= days(30)) new30 += 1;
      if (r.welcome_sent_at) welcomeSent += 1;
      const src = r.source || "unknown";
      sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
    }

    const bySource = [...sourceCounts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalActive,
      pending,
      unsubscribed,
      new7,
      new30,
      byAudience,
      topSource: bySource[0]?.source ?? null,
      bySource,
      welcomeSent,
      recent: list.slice(0, 20).map((r) => ({
        created_at: r.created_at,
        audience_type: r.audience_type ?? "GENERAL",
        source: r.source ?? "unknown",
        status: r.unsubscribed_at ? "unsubscribed" : r.status,
      })),
    };
  });

export const listEditionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("insider_editions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return { editions: (data ?? []) as InsiderEdition[] };
  });

export const saveEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      title: string;
      subject: string;
      previewText?: string | null;
      bodyMd: string;
      audienceType: string;
      isPublic: boolean;
      status: string;
    }) => {
      const title = String(input.title ?? "").trim().slice(0, 160);
      if (!title) throw new Error("Title is required");
      const audienceType: AudienceType = isValidAudience(input.audienceType)
        ? input.audienceType
        : "GENERAL";
      const status = ["draft", "published"].includes(input.status) ? input.status : "draft";
      return {
        id: input.id ?? null,
        title,
        subject: String(input.subject ?? title).trim().slice(0, 160),
        previewText: input.previewText ? String(input.previewText).slice(0, 200) : null,
        bodyMd: String(input.bodyMd ?? "").slice(0, 20000),
        audienceType,
        isPublic: Boolean(input.isPublic),
        status,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      title: data.title,
      subject: data.subject,
      preview_text: data.previewText,
      body_md: data.bodyMd,
      audience_type: data.audienceType,
      is_public: data.isPublic,
      status: data.status,
      published_at: data.status === "published" ? new Date().toISOString() : null,
    };

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("insider_editions")
        .update(payload)
        .eq("id", data.id)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { edition: row as InsiderEdition };
    }

    const base = insiderSlug(data.title) || "insider";
    const slug = `${base}-${Date.now().toString(36).slice(-4)}`;
    const { data: row, error } = await context.supabase
      .from("insider_editions")
      .insert({ ...payload, slug, created_by: context.userId })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { edition: row as InsiderEdition };
  });

export const deleteEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("insider_editions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Sends an edition. `testEmail` sends a single preview copy; otherwise the
 * edition goes to confirmed, non-unsubscribed subscribers in its audience.
 */
export const sendEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; testEmail?: string | null }) => ({
    id: String(input.id),
    testEmail: input.testEmail ? String(input.testEmail).trim().toLowerCase() : null,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { enqueueInsiderEmail, insiderAdminClient } = await import(
      "@/lib/insider-email.server"
    );
    const supabase = insiderAdminClient();

    const { data: edition } = await supabase
      .from("insider_editions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!edition) throw new Error("Edition not found");

    const props = {
      title: edition.title,
      previewText: edition.preview_text,
      bodyText: edition.body_md,
      slug: edition.is_public ? edition.slug : null,
    };

    if (data.testEmail) {
      const res = await enqueueInsiderEmail(supabase, {
        templateName: "insider-edition",
        to: data.testEmail,
        props,
        subject: `[TEST] ${edition.subject}`,
        idempotencyKey: `insider-edition-test-${edition.id}-${Date.now()}`,
      });
      return { sent: res.ok ? 1 : 0, skipped: res.ok ? 0 : 1, test: true };
    }

    let query = supabase
      .from("subscribers")
      .select("id,email,audience_type")
      .eq("status", "confirmed")
      .is("unsubscribed_at", null)
      .limit(5000);
    if (edition.audience_type !== "GENERAL") {
      query = query.eq("audience_type", edition.audience_type);
    }
    const { data: subs } = await query;

    let sent = 0;
    let skipped = 0;
    for (const s of (subs ?? []) as Array<Record<string, any>>) {
      const res = await enqueueInsiderEmail(supabase, {
        templateName: "insider-edition",
        to: s.email,
        props,
        subject: edition.subject,
        idempotencyKey: `insider-edition-${edition.id}-${s.id}`,
      });
      if (res.ok) sent += 1;
      else skipped += 1;
    }

    await supabase
      .from("insider_editions")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipients_count: sent,
        published_at: edition.published_at ?? new Date().toISOString(),
      })
      .eq("id", edition.id);

    return { sent, skipped, test: false };
  });
