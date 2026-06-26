import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export interface AlertConfigDTO {
  enabled: boolean;
  threshold: number;
  cooldown_minutes: number;
  recipient_email: string | null;
  webhook_url: string | null;
  last_alert_at: string | null;
}

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden: admin only");
}

export const getAlertConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlertConfigDTO> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("cover_audit_alert_config")
      .select("enabled,threshold,cooldown_minutes,recipient_email,webhook_url,last_alert_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      (data as AlertConfigDTO | null) ?? {
        enabled: true,
        threshold: 1,
        cooldown_minutes: 60,
        recipient_email: null,
        webhook_url: null,
        last_alert_at: null,
      }
    );
  });

const Input = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(1).max(10000),
  cooldown_minutes: z.number().int().min(0).max(10080),
  recipient_email: z.string().email().nullable().or(z.literal("").transform(() => null)),
  webhook_url: z.string().url().nullable().or(z.literal("").transform(() => null)),
});

export const saveAlertConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<AlertConfigDTO> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("cover_audit_alert_config")
      .upsert({ id: 1, ...data }, { onConflict: "id" })
      .select("enabled,threshold,cooldown_minutes,recipient_email,webhook_url,last_alert_at")
      .single();
    if (error) throw new Error(error.message);
    return row as AlertConfigDTO;
  });

// Force-send an alert using the current cache, ignoring cooldown.
export const sendTestAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { maybeSendCoverAuditAlert, loadAlertConfig } = await import("@/lib/cover-audit-alert.server");
    const { data: rows, error } = await supabaseAdmin.from("cover_audit_runs").select("*");
    if (error) throw new Error(error.message);
    const results = (rows ?? []).map((r) => ({
      ok: r.ok,
      checkedAt: r.checked_at,
      category: r.category as "ebooks" | "courses" | "templates" | "audio" | "leadership",
      summary: { total: r.total, passing: r.passing, failing: r.failing },
      results: (r.results as unknown[]) as never,
      failing: (r.failing_rows as unknown[]) as never,
    }));
    const config = await loadAlertConfig(supabaseAdmin);
    if (config) {
      await supabaseAdmin.from("cover_audit_alert_config").update({ last_alert_at: null }).eq("id", 1);
    }
    return maybeSendCoverAuditAlert(supabaseAdmin, results);
  });
