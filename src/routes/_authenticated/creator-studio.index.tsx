import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Film, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  createCreatorStudioProject,
  listCreatorStudioProjects,
} from "@/lib/creator-studio.functions";
import {
  CREATOR_STUDIO_PROJECT_TYPE_LABELS,
  type CreatorStudioProjectType,
} from "@/lib/creator-studio.schema";

export const Route = createFileRoute("/_authenticated/creator-studio/")({
  component: CreatorStudioHome,
});

function CreatorStudioHome() {
  const navigate = useNavigate();
  const listProjects = useServerFn(listCreatorStudioProjects);
  const createProject = useServerFn(createCreatorStudioProject);
  const [creating, setCreating] = useState<CreatorStudioProjectType | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["creator-studio", "projects"],
    queryFn: () => listProjects(),
    retry: false,
  });

  async function start(projectType: CreatorStudioProjectType) {
    setCreating(projectType);
    try {
      const project = await createProject({ data: { projectType } });
      navigate({
        to: "/creator-studio/$projectId",
        params: { projectId: project.id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creator Studio could not start.");
    } finally {
      setCreating(null);
    }
  }

  const projects = projectsQuery.data ?? [];

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-navy p-3 text-gold">
            <Film size={26} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
              AurumVault Creator Studio™
            </p>
            <h1 className="mt-1 font-display text-3xl text-navy md:text-4xl">
              Turn your product into a polished short video.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">
              Choose what you want to promote, add your product and assets, then build the
              creative brief. No timeline editor and no manual clip trimming.
            </p>
          </div>
        </div>

        <section className="mt-8" aria-labelledby="creator-studio-create-heading">
          <h2
            id="creator-studio-create-heading"
            className="text-xs font-bold uppercase tracking-[0.18em] text-mute"
          >
            What do you want to create?
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(CREATOR_STUDIO_PROJECT_TYPE_LABELS) as [
              CreatorStudioProjectType,
              string,
            ][]).map(([projectType, label]) => (
              <button
                key={projectType}
                type="button"
                onClick={() => void start(projectType)}
                disabled={creating !== null}
                className="group min-h-32 rounded-2xl border border-ink/10 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating === projectType ? (
                  <Loader2 size={18} className="animate-spin text-gold" aria-hidden />
                ) : (
                  <Sparkles size={18} className="text-gold" aria-hidden />
                )}
                <p className="mt-3 font-semibold text-navy">{label}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-mute group-hover:text-navy">
                  Start <ArrowRight size={13} aria-hidden />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="creator-studio-projects-heading">
          <div className="flex items-center justify-between gap-4">
            <h2 id="creator-studio-projects-heading" className="font-display text-2xl text-navy">
              Your video projects
            </h2>
            <span className="text-xs text-mute">{projects.length} saved</span>
          </div>

          {projectsQuery.isLoading ? (
            <p className="mt-4 text-sm text-mute">Loading your projects…</p>
          ) : projectsQuery.error ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              Creator Studio projects are temporarily unavailable.
            </p>
          ) : projects.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white p-8 text-center">
              <Film className="mx-auto text-mute" aria-hidden />
              <p className="mt-2 text-sm text-mute">
                Choose a format above to create your first promotional video project.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to="/creator-studio/$projectId"
                  params={{ projectId: project.id }}
                  className="rounded-2xl border border-ink/10 bg-white p-5 transition hover:border-gold/50 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">
                        {project.product_title || project.title}
                      </p>
                      <p className="mt-1 text-xs text-mute">
                        {CREATOR_STUDIO_PROJECT_TYPE_LABELS[project.project_type]} ·{" "}
                        {project.duration_seconds}s · Step {project.wizard_step}/7 ·{" "}
                        {project.status}
                      </p>
                    </div>
                    <ArrowRight size={16} className="shrink-0 text-mute" aria-hidden />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </PublisherShell>
  );
}
