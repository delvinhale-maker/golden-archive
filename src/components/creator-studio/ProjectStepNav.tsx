import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

const STEPS = [
  { key: "assets", label: "Assets", to: "/creator-studio/$projectId/assets" as const },
  { key: "style", label: "Style", to: "/creator-studio/$projectId/style" as const },
  { key: "preview", label: "Preview", to: "/creator-studio/$projectId/preview" as const },
  { key: "render", label: "Generate", to: "/creator-studio/$projectId/render" as const },
] as const;

export type ProjectStepKey = (typeof STEPS)[number]["key"];

/** Shared step tab bar for the four project-scoped wizard sub-routes. No timeline, no drag targets -- fixed forward/back steps only. */
export function ProjectStepNav({
  projectId,
  current,
}: {
  projectId: string;
  current: ProjectStepKey;
}) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Progress" className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-2">
          <Link
            to={step.to}
            params={{ projectId }}
            className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
              i === currentIndex
                ? "bg-[#7A2E52] text-white"
                : i < currentIndex
                  ? "bg-[#7A2E52]/10 text-[#7A2E52]"
                  : "bg-ink/5 text-mute"
            }`}
          >
            {i < currentIndex && <Check size={12} aria-hidden="true" />}
            {step.label}
          </Link>
          {i < STEPS.length - 1 && <span className="h-px w-6 bg-ink/10" aria-hidden="true" />}
        </div>
      ))}
    </nav>
  );
}
