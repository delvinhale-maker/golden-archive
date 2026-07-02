import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/edit/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/dashboard/new", search: { id: params.id } });
  },
  component: () => null,
});
