import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/creator-dashboard")({
  head: () => ({
    meta: [
      { title: "Creator Dashboard — AurumVault" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Navigate to="/dashboard" replace />,
});
