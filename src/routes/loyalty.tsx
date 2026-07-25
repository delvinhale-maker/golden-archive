import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/loyalty")({
  head: () => ({
    meta: [
      { title: "AurumVault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Navigate to="/" replace />,
});
