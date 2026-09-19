import { createFileRoute } from "@tanstack/react-router";

function gitSha(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_SHA ??
    process.env.COMMIT_SHA ??
    "unknown"
  );
}

function projectRefFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const host = new URL(value).hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] ?? null : null;
  } catch {
    return null;
  }
}

async function checkSupabase(
  url: string | null,
  publishableKey: string | null,
): Promise<"ok" | "misconfigured" | "unreachable"> {
  if (!url || !publishableKey) return "misconfigured";
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return response.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl =
          process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL ?? null;
        const publishableKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
          null;
        const environment =
          process.env.APP_ENV ??
          process.env.VERCEL_ENV ??
          process.env.NODE_ENV ??
          "unknown";
        const actualProjectRef = projectRefFromUrl(supabaseUrl);
        const expectedProjectRef = process.env.SUPABASE_PROJECT_REF ?? null;
        const projectMatch =
          expectedProjectRef === null || actualProjectRef === expectedProjectRef;
        const backend = projectMatch
          ? await checkSupabase(supabaseUrl, publishableKey)
          : "misconfigured";
        const sha = gitSha();
        const ok = backend === "ok" && sha !== "unknown";

        return Response.json(
          {
            ok,
            service: "aurumvault",
            environment,
            git_sha: sha,
            backend,
            supabase_project_ref: actualProjectRef,
            project_match: projectMatch,
            timestamp: new Date().toISOString(),
          },
          {
            status: ok ? 200 : 503,
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
