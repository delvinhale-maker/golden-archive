import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/gift-cards")({
  head: () => ({
    meta: [
      { title: "AurumVault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Navigate to="/" replace />,
});
