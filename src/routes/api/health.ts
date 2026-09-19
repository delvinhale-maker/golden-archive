import { createFileRoute } from "@tanstack/react-router";

function gitSha(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_SHA ??
    process.env.COMMIT_SHA ??
    "unknown"
  );
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl =
          process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL ?? null;
        const environment =
          process.env.VERCEL_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? "unknown";

        let backend: "ok" | "degraded" = "ok";
        if (!supabaseUrl) backend = "degraded";

        return Response.json(
          {
            ok: backend === "ok",
            service: "aurumvault",
            environment,
            git_sha: gitSha(),
            backend,
            timestamp: new Date().toISOString(),
          },
          {
            status: backend === "ok" ? 200 : 503,
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
