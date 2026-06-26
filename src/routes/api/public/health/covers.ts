import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Row = { id: string; title: string; category: string; cover_url: string | null };

async function checkUrl(url: string): Promise<{ ok: boolean; status?: number; contentType?: string; error?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    let res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    // Some storage hosts don't support HEAD — fall back to ranged GET.
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

export const Route = createFileRoute("/api/public/health/covers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const category = url.searchParams.get("category") ?? "ebooks";

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const { data, error } = await supabase
          .from("marketplace_products")
          .select("id,title,category,cover_url")
          .eq("status", "approved")
          .eq("category", category as "ebooks" | "courses" | "templates" | "audio" | "leadership");

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const rows = (data ?? []) as Row[];
        const results = await Promise.all(
          rows.map(async (r) => {
            const hasHttp = !!r.cover_url && /^https?:\/\//.test(r.cover_url);
            if (!hasHttp) {
              return {
                id: r.id,
                title: r.title,
                category: r.category,
                cover_url: r.cover_url,
                ok: false,
                reason: "missing_or_invalid_url",
              };
            }
            const probe = await checkUrl(r.cover_url!);
            return {
              id: r.id,
              title: r.title,
              category: r.category,
              cover_url: r.cover_url,
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
        const allOk = failing.length === 0;

        return Response.json(
          {
            ok: allOk,
            checkedAt: new Date().toISOString(),
            category,
            summary: {
              total: results.length,
              passing: results.length - failing.length,
              failing: failing.length,
            },
            failing,
            results,
          },
          {
            status: allOk ? 200 : 500,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
