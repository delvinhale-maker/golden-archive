import { createFileRoute } from "@tanstack/react-router";
import { PublishFlow } from "./dashboard.new";

export const Route = createFileRoute("/_authenticated/dashboard/edit/$id")({
  component: EditTitleRoute,
});

function EditTitleRoute() {
  const { id } = Route.useParams();
  return <PublishFlow editingId={id} />;
}
