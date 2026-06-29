import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LogErrorInput {
  message: string;
  stack?: string | null;
  source?: "client" | "boundary" | "unhandled_rejection" | "window_error" | "server";
  severity?: "warn" | "error" | "fatal";
  route?: string | null;
  url?: string | null;
  userAgent?: string | null;
  context?: Record<string, unknown>;
}

// Cheap, stable fingerprint: first line of message + top stack frame
function fingerprintOf(message: string, stack?: string | null): string {
  const msg = (message || "").split("\n")[0].trim().slice(0, 160);
  const frame = (stack || "")
    .split("\n")
    .find((l) => l.includes("at "))?.trim()
    .slice(0, 160) ?? "";
  return `${msg}|${frame}`;
}

/**
 * Public server function: any visitor can report a runtime error from the browser.
 * Inserts into error_logs (service role) and, for fatal severity, fires a throttled
 * email alert to all admins.
 */
export const logError = createServerFn({ method: "POST" })
  .inputValidator((input: LogErrorInput) => {
    if (!input || typeof input.message !== "string" || !input.message.trim()) {
      throw new Error("message is required");
    }
    return {
      message: input.message.slice(0, 2000),
      stack: input.stack ? String(input.stack).slice(0, 8000) : null,
      source: (input.source ?? "client") as LogErrorInput["source"],
      severity: (input.severity ?? "error") as LogErrorInput["severity"],
      route: input.route ? String(input.route).slice(0, 300) : null,
      url: input.url ? String(input.url).slice(0, 500) : null,
      userAgent: input.userAgent ? String(input.userAgent).slice(0, 500) : null,
      context: input.context && typeof input.context === "object" ? input.context : {},
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fingerprint = fingerprintOf(data.message, data.stack);

    const { data: inserted, error } = await supabaseAdmin
      .from("error_logs")
      .insert({
        message: data.message,
        stack: data.stack,
        source: data.source,
        severity: data.severity,
        route: data.route,
        url: data.url,
        user_agent: data.userAgent,
        fingerprint,
        context: data.context,
      })
      .select("id, occurred_at")
      .single();

    if (error) {
      console.error("logError insert failed", error);
      return { ok: false as const };
    }

    // Throttled email alert on fatal or boundary errors
    if (data.severity === "fatal" || data.source === "boundary") {
      try {
        await maybeSendAlert({
          fingerprint,
          message: data.message,
          stack: data.stack ?? "",
          source: data.source ?? "client",
          severity: data.severity ?? "error",
          route: data.route ?? "",
          url: data.url ?? "",
          occurredAt: inserted.occurred_at as string,
        });
      } catch (e) {
        console.error("alert dispatch failed", e);
      }
    }

    return { ok: true as const, id: inserted.id };
  });

/** Admin-only: list recent error logs. */
export const listErrorLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; severity?: string } | undefined) => ({
    limit: Math.min(Math.max(input?.limit ?? 100, 1), 500),
    severity: input?.severity,
  }))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    let q = context.supabase
      .from("error_logs")
      .select("id, occurred_at, source, severity, message, route, url, fingerprint, alerted_at")
      .order("occurred_at", { ascending: false })
      .limit(data.limit);
    if (data.severity) q = q.eq("severity", data.severity);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

/** Admin-only: aggregate counts for the dashboard header. */
export const errorLogStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ count: lastHour }, { count: lastDay }, { count: fatalDay }] = await Promise.all([
      supabaseAdmin.from("error_logs").select("id", { count: "exact", head: true }).gte("occurred_at", sinceHour),
      supabaseAdmin.from("error_logs").select("id", { count: "exact", head: true }).gte("occurred_at", sinceDay),
      supabaseAdmin
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", sinceDay)
        .eq("severity", "fatal"),
    ]);

    return {
      lastHour: lastHour ?? 0,
      lastDay: lastDay ?? 0,
      fatalDay: fatalDay ?? 0,
    };
  });

/** Admin-only: send a test alert email to confirm the pipeline works end-to-end. */
export const sendTestErrorAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const fingerprint = `test|${Date.now()}`;
    await maybeSendAlert({
      fingerprint,
      message: "TEST ALERT — pipeline check",
      stack: "at sendTestErrorAlert (manual admin trigger)",
      source: "boundary",
      severity: "fatal",
      route: "/admin/errors",
      url: "https://www.aurumvault.store/admin/errors",
      occurredAt: new Date().toISOString(),
      force: true,
    });
    return { ok: true };
  });

// ---- internal: render + enqueue an alert email to every admin, throttled ----

async function maybeSendAlert(args: {
  fingerprint: string;
  message: string;
  stack: string;
  source: string;
  severity: string;
  route: string;
  url: string;
  occurredAt: string;
  force?: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Throttle: skip if any row with this fingerprint was alerted in last 15 min
  if (!args.force) {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("error_logs")
      .select("id")
      .eq("fingerprint", args.fingerprint)
      .gte("alerted_at", since)
      .limit(1);
    if (recent && recent.length > 0) return;
  }

  // Count recent occurrences for context
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabaseAdmin
    .from("error_logs")
    .select("id", { count: "exact", head: true })
    .eq("fingerprint", args.fingerprint)
    .gte("occurred_at", sinceHour);

  // Look up admin emails
  const { data: adminRows } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminIds = (adminRows ?? []).map((r) => r.user_id as string);
  if (adminIds.length === 0) return;

  // Resolve emails via auth admin API
  const recipients: string[] = [];
  for (const id of adminIds) {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
    const email = u?.user?.email;
    if (email) recipients.push(email);
  }
  if (recipients.length === 0) return;

  // Render template
  const React = await import("react");
  const { render } = await import("react-email");
  const { template } = await import("@/lib/email-templates/error-alert");

  const templateData = {
    message: args.message,
    stack: args.stack,
    source: args.source,
    severity: args.severity,
    route: args.route,
    url: args.url,
    occurredAt: args.occurredAt,
    recentCount: recentCount ?? 1,
    reportUrl: "https://www.aurumvault.store/admin/errors",
  };

  const element = React.createElement(template.component as any, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const SENDER_DOMAIN = "notify.www.aurumvault.store";
  const FROM_DOMAIN = "www.aurumvault.store";
  const SITE_NAME = "AurumVault Monitoring";

  for (const to of recipients) {
    const messageId = crypto.randomUUID();
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "error-alert",
      recipient_email: to,
      status: "pending",
    });
    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "error-alert",
        idempotency_key: `error-alert-${args.fingerprint}-${Math.floor(Date.now() / (15 * 60 * 1000))}`,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) console.error("enqueue error-alert failed", error);
  }

  // Mark as alerted (most recent row with this fingerprint)
  await supabaseAdmin
    .from("error_logs")
    .update({ alerted_at: new Date().toISOString() })
    .eq("fingerprint", args.fingerprint)
    .is("alerted_at", null);
}
