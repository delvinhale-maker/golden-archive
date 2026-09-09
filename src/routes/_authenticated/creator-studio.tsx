import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Film, Sparkles } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import {
  createCreatorStudioProject,
  listCreatorStudioProjects,
} from "@/lib/creator-studio.functions";
import type { z } from "zod";
import { CreatorStudioGoalSchema } from "@/lib/creator-studio.schema";

export const Route = createFileRoute("/_authenticated/creator-studio")({
  component: CreatorStudioHome,
});

type Goal = z.infer<typeof CreatorStudioGoalSchema>;

const GOALS: Array<{ key: Goal; title: string; detail: string }> = [
  { key: "PROMOTE_EBOOK", title: "Promote my eBook", detail: "Turn your cover and pages into a polished vertical promo." },
  { key: "PROMOTE_COURSE", title: "Promote my course", detail: "Show the transformation, modules, and call to action." },
  { key: "PROMOTE_PLANNER", title: "Promote my planner", detail: "Reveal the cover and interior pages in motion." },
  { key: "TIKTOK_AD", title: "Create TikTok ad", detail: "A fast product-first 9:16 promotional cut." },
  { key: "INSTAGRAM_REEL", title: "Create Instagram Reel", detail: "A clean branded Reel built from your product assets." },
  { key: "PRODUCT_TRAILER", title: "Create product trailer", detail: "A cinematic short trailer for a digital product." },
  { key: "BOOK_TRAILER", title: "Create book trailer", detail: "A cinematic reveal designed around your book." },
];

function CreatorStudioHome() {
  const navigate = useNavigate();
  const listFn = useServerFn(listCreatorStudioProjects);
  const createFn = useServerFn(createCreatorStudioProject);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["creator-studio", "projects"],
    queryFn: () => listFn(),
    retry: false,
  });

  async function start(goal: Goal) {
    try {
      await createFn({ data: { goal } });
      await refetch();
      toast.success("Video project created");
      // CS1 keeps the wizard on one shell; CS2+ can route to project-specific steps.
      navigate({ to: "/creator-studio", replace: true });
    } catch {
      toast.error("Couldn't create your video project");
    }
  }

  return (
    <PublisherShell accent={ACCENTS.help}>
      <div className="max-w-5xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-navy">
          <Sparkles size={14} /> AurumVault Creator Studio™
        </div>
        <h1 className="mt-4 font-display text-4xl text-navy">Turn my product into a promo video.</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Choose what you want to make, add your cover, screenshots, logo and CTA, then AurumVault builds the video. No timeline editor required.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GOALS.map((goal) => (
            <button
              key={goal.key}
              type="button"
              onClick={() => start(goal.key)}
              className="group rounded-2xl border border-ink/10 bg-white p-5 text-left hover:border-navy/30"
            >
              <Film size={20} className="text-navy" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="font-semibold text-navy">{goal.title}</p>
                <ArrowRight size={16} className="text-mute group-hover:text-navy" />
              </div>
              <p className="mt-1 text-xs leading-5 text-mute">{goal.detail}</p>
            </button>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl text-navy">My videos</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-mute">Loading projects…</p>
          ) : !data?.length ? (
            <div className="mt-3 rounded-2xl border border-dashed border-ink/15 bg-white p-6 text-sm text-mute">
              No Creator Studio projects yet. Choose a video type above to begin.
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {data.map((project) => (
                <div key={project.id} className="rounded-xl border border-ink/10 bg-white p-4">
                  <p className="font-semibold text-navy">{project.title}</p>
                  <p className="mt-1 text-xs text-mute">{project.goal.replaceAll("_", " ")} · {project.duration_seconds}s · {project.status}</p>
                  <p className="mt-3 text-xs font-semibold text-navy">Wizard step {project.wizard_step} of 5</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PublisherShell>
  );
}
