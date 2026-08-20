import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/creator-business-tools")({
  component: () => <Outlet />,
});
