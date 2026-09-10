import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Film, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { createCreatorStudioProject, listCreatorStudioProjects } from "@/lib/creator-studio.functions";
import { CREATOR_STUDIO_GOAL_LABELS, type CreatorStudioGoal } from "@/lib/creator-studio.schema";

export const Route = createFileRoute("/_authenticated/dashboard/creator-studio/")({ component: CreatorStudioHome });

function CreatorStudioHome() {
  const navigate = useNavigate();
  const listFn = useServerFn(listCreatorStudioProjects);
  const createFn = useServerFn(createCreatorStudioProject);
  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ["creator-studio", "projects"],
    queryFn: () => listFn(),
    retry: false,
  });

  async function create(goal: CreatorStudioGoal) {
    try {
      const project = await createFn({ data: { goal, title: CREATOR_STUDIO_GOAL_LABELS[goal], durationSeconds: 30, styleKey: "LUXURY_EDITORIAL", wizardStep: 1 } });
      navigate({ to: "/dashboard/creator-studio/$projectId", params: { projectId: project.id } });
    } catch (error: any) {
      toast.error(error?.message ?? "Couldn't start Creator Studio");
    }
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="max-w-5xl">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-navy p-3 text-gold"><Film size={24} /></div>
          <div>
            <h1 className="font-display text-3xl text-navy">AurumVault Creator Studio</h1>
            <p className="mt-1 max-w-2xl text-sm text-mute">Turn your product into a polished promotional video. No timeline. No editing software. Choose a goal and build the creative brief.</p>
          </div>
        </div>

        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mute">What do you want to create?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(CREATOR_STUDIO_GOAL_LABELS) as [CreatorStudioGoal, string][]).map(([goal, label]) => (
              <button key={goal} onClick={() => create(goal)} className="group rounded-2xl border border-ink/10 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-sm">
                <Sparkles size={18} className="text-gold" />
                <p className="mt-3 font-semibold text-navy">{label}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-mute group-hover:text-navy">Start <ArrowRight size={13} /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl text-navy">Your projects</h2><span className="text-xs text-mute">{projects.length} active</span></div>
          {isLoading ? <p className="mt-4 text-sm text-mute">Loading projects…</p> : error ? <p className="mt-4 text-sm text-red-700">Creator Studio is temporarily unavailable.</p> : projects.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white p-8 text-center"><Plus className="mx-auto text-mute" /><p className="mt-2 text-sm text-mute">Choose a goal above to create your first video project.</p></div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {projects.map((project) => <Link key={project.id} to="/dashboard/creator-studio/$projectId" params={{ projectId: project.id }} className="rounded-2xl border border-ink/10 bg-white p-5 hover:border-gold/50"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-navy">{project.product_title || project.title}</p><p className="mt-1 text-xs text-mute">{CREATOR_STUDIO_GOAL_LABELS[project.goal]} · {project.duration_seconds}s · Step {project.wizard_step}/5</p></div><ArrowRight size={16} className="text-mute" /></div></Link>)}
            </div>
          )}
        </section>
      </div>
    </PublisherShell>
  );
}
