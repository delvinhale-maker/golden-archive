import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ManuscriptPreviewer } from "@/components/marketplace/ManuscriptPreviewer";

const search = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
});

export const Route = createFileRoute("/preview-sample")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Manuscript Preview Sample — AurumVault" },
      {
        name: "description",
        content:
          "Public read-only Manuscript previewer for verifying image and text alignment across Phone, Tablet, and Kindle sizes.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PreviewSamplePage,
});

function PreviewSamplePage() {
  const { url, title } = Route.useSearch();
  const navigate = useNavigate();

  // Default to a small local sample DOCX with text + a picture so alignment
  // can be verified without authentication or Supabase storage access.
  const manuscriptPath =
    url ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/samples/sample-manuscript.docx`
      : "/samples/sample-manuscript.docx");

  return (
    <ManuscriptPreviewer
      manuscriptPath={manuscriptPath}
      title={title ?? "Sample Manuscript"}
      coverUrl={null}
      onClose={() => navigate({ to: "/" })}
    />
  );
}
