import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CATEGORIES = ["ebooks", "courses", "templates", "audio", "leadership"] as const;
type Category = (typeof CATEGORIES)[number];

export type CoverAuditRow = {
  id: string;
  title: string;
  category: string;
  cover_url: string | null;
  ok: boolean;
  status?: number;
  contentType?: string;
  reason?: string;
};

export type CoverAuditResult = {
  ok: boolean;
  checkedAt: string;
  category: Category;
  summary: { total: number; passing: number; failing: number };
  results: CoverAuditRow[];
  failing: CoverAuditRow[];
};

async function checkUrl(url: string) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    let res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    if (!res.ok || !res.headers.get("content-type")) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal: ctrl.signal });
    }
    clearTimeout(t);
    const ct = res.headers.get("content-type") ?? undefined;
    const ok = res.ok && !!ct && ct.startsWith("image/");
    return { ok, status: res.status, contentType: ct };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const auditCovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ category: z.enum(CATEGORIES).default("ebooks") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<CoverAuditResult> => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { data: rows, error } = await supabase
      .from("marketplace_products")
      .select("id,title,category,cover_url")
      .eq("status", "approved")
      .eq("category", data.category);

    if (error) throw new Error(error.message);

    const results: CoverAuditRow[] = await Promise.all(
      (rows ?? []).map(async (r) => {
        const hasHttp = !!r.cover_url && /^https?:\/\//.test(r.cover_url);
        if (!hasHttp) {
          return { ...r, ok: false, reason: "missing_or_invalid_url" };
        }
        const probe = await checkUrl(r.cover_url!);
        return {
          ...r,
          ok: probe.ok,
          status: probe.status,
          contentType: probe.contentType,
          reason: probe.ok
            ? undefined
            : probe.error
              ? `fetch_error:${probe.error}`
              : `bad_response:${probe.status ?? "?"}:${probe.contentType ?? "no-content-type"}`,
        };
      }),
    );

    const failing = results.filter((r) => !r.ok);
    return {
      ok: failing.length === 0,
      checkedAt: new Date().toISOString(),
      category: data.category,
      summary: { total: results.length, passing: results.length - failing.length, failing: failing.length },
      results,
      failing,
    };
  });
