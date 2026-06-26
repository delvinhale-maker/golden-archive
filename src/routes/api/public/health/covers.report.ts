import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Row = { id: string; title: string; category: string; cover_url: string | null };

async function checkUrl(url: string): Promise<{ ok: boolean; status?: number; contentType?: string; error?: string }> {
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

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const Route = createFileRoute("/api/public/health/covers/report")({
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
          return new Response(`<h1>Error</h1><p>${esc(error.message)}</p>`, {
            status: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        const rows = (data ?? []) as Row[];
        const results = await Promise.all(
          rows.map(async (r) => {
            const hasHttp = !!r.cover_url && /^https?:\/\//.test(r.cover_url);
            if (!hasHttp) {
              return { ...r, ok: false, reason: "missing_or_invalid_url" as const };
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
        const passing = results.length - failing.length;
        const allOk = failing.length === 0;
        const checkedAt = new Date().toISOString();

        const failCards = failing
          .map(
            (r) => `
            <article class="card fail">
              <div class="thumb">
                ${
                  r.cover_url && /^https?:\/\//.test(r.cover_url)
                    ? `<img src="${esc(r.cover_url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'broken',textContent:'image failed to load'}))" />`
                    : `<div class="broken">no url</div>`
                }
              </div>
              <div class="meta">
                <h3>${esc(r.title)}</h3>
                <p class="cat">${esc(r.category)}</p>
                <p class="reason">${esc(r.reason ?? "unknown")}</p>
                <p class="id">${esc(r.id)}</p>
                ${r.cover_url ? `<a href="${esc(r.cover_url)}" target="_blank" rel="noopener">open url ↗</a>` : ""}
              </div>
            </article>`,
          )
          .join("");

        const passList = results
          .filter((r) => r.ok)
          .map((r) => `<li><span class="dot ok"></span>${esc(r.title)} <span class="muted">· ${esc(r.id)}</span></li>`)
          .join("");

        const categories = ["ebooks", "courses", "templates", "audio", "leadership"];
        const catLinks = categories
          .map(
            (c) =>
              `<a class="chip ${c === category ? "active" : ""}" href="?category=${c}">${c}</a>`,
          )
          .join("");

        const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Cover Audit — ${esc(category)}</title>
  <style>
    :root { --navy:#0f1629; --gold:#c9a44a; --bg:#f7f7f5; --card:#fff; --muted:#6b7280; --fail:#b91c1c; --ok:#15803d; }
    *{box-sizing:border-box}
    body{margin:0;font:15px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif;color:var(--navy);background:var(--bg)}
    header{padding:32px 24px 16px;max-width:1100px;margin:0 auto}
    h1{margin:0 0 4px;font-size:24px}
    .sub{color:var(--muted);font-size:13px}
    main{max-width:1100px;margin:0 auto;padding:0 24px 64px}
    .stats{display:flex;gap:24px;margin:20px 0;flex-wrap:wrap}
    .stat{background:var(--card);border:1px solid #e5e7eb;border-radius:8px;padding:12px 18px;min-width:120px}
    .stat .n{font-size:22px;font-weight:700}
    .stat .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
    .banner{padding:12px 16px;border-radius:8px;margin:16px 0;font-weight:600}
    .banner.ok{background:#dcfce7;color:var(--ok)}
    .banner.fail{background:#fee2e2;color:var(--fail)}
    .chips{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 24px}
    .chip{padding:6px 12px;border-radius:999px;background:#fff;border:1px solid #e5e7eb;color:var(--navy);text-decoration:none;font-size:13px}
    .chip.active{background:var(--navy);color:#fff;border-color:var(--navy)}
    h2{margin:32px 0 12px;font-size:16px;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
    .card{background:var(--card);border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
    .card.fail{border-color:#fecaca}
    .thumb{aspect-ratio:1/1.6;background:#f1f1ef;display:grid;place-items:center;overflow:hidden}
    .thumb img{width:100%;height:100%;object-fit:cover}
    .broken{color:var(--fail);font-size:12px;padding:12px;text-align:center}
    .meta{padding:12px 14px 14px}
    .meta h3{margin:0 0 4px;font-size:14px}
    .cat{margin:0;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:1px}
    .reason{margin:8px 0 4px;font-size:12px;color:var(--fail);font-family:ui-monospace,monospace;word-break:break-all}
    .id{margin:0;font-size:11px;color:var(--muted);font-family:ui-monospace,monospace}
    .meta a{font-size:12px;color:var(--navy)}
    ul.pass{list-style:none;padding:0;margin:0;columns:2;column-gap:24px}
    @media(max-width:640px){ul.pass{columns:1}}
    ul.pass li{padding:6px 0;font-size:13px;break-inside:avoid}
    .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;vertical-align:middle}
    .dot.ok{background:var(--ok)}
    .muted{color:var(--muted);font-size:12px;font-family:ui-monospace,monospace}
    footer{max-width:1100px;margin:0 auto;padding:24px;color:var(--muted);font-size:12px}
    a.json{color:var(--navy)}
  </style>
</head>
<body>
  <header>
    <h1>Cover Audit</h1>
    <p class="sub">Checked ${esc(checkedAt)} · <a class="json" href="/api/public/health/covers?category=${esc(category)}">view raw JSON</a></p>
  </header>
  <main>
    <div class="chips">${catLinks}</div>
    <div class="banner ${allOk ? "ok" : "fail"}">${allOk ? "All covers passing ✓" : `${failing.length} cover${failing.length === 1 ? "" : "s"} failing`}</div>
    <div class="stats">
      <div class="stat"><div class="n">${results.length}</div><div class="l">Total</div></div>
      <div class="stat"><div class="n" style="color:var(--ok)">${passing}</div><div class="l">Passing</div></div>
      <div class="stat"><div class="n" style="color:var(--fail)">${failing.length}</div><div class="l">Failing</div></div>
    </div>
    ${failing.length ? `<h2>Failing</h2><div class="grid">${failCards}</div>` : ""}
    ${passing ? `<h2>Passing</h2><ul class="pass">${passList}</ul>` : ""}
    ${!results.length ? `<p class="sub">No approved products in this category.</p>` : ""}
  </main>
  <footer>AurumVault · cover health report</footer>
</body>
</html>`;

        return new Response(html, {
          status: allOk ? 200 : 500,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
