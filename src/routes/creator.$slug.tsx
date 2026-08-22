import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Friendly creator alias. `/store/:slug` is the already-indexed canonical URL,
 * so this route permanently forwards rather than serving duplicate content.
 */
export const Route = createFileRoute("/creator/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$slug", params: { slug: params.slug }, replace: true });
  },
});
