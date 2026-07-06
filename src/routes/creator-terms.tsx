import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/creator-terms")({
  head: () => ({
    meta: [
      { title: "Creator Terms — AurumVault" },
      {
        name: "description",
        content: "The Creator Agreement and terms of service for AurumVault creators.",
      },
    ],
  }),
  component: () => <Navigate to="/creator-agreement" replace />,
});
