import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Short marketing/share link for the book "Dethroning The Bully 2".
 * Forwards to the canonical clean product URL (/products/dethroning-the-bully-2)
 * so there is a single indexable product page.
 */
export const Route = createFileRoute("/dethroning-the-bully-2")({
  beforeLoad: () => {
    throw redirect({
      to: "/products/$id",
      params: { id: "dethroning-the-bully-2" },
      replace: true,
    });
  },
});
