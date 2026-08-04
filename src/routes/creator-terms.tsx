import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy duplicate of /creator-agreement. Kept only as a permanent redirect
// so old links and indexed URLs keep working.
export const Route = createFileRoute("/creator-terms")({
  beforeLoad: () => {
    throw redirect({ to: "/creator-agreement", statusCode: 301 });
  },
});
