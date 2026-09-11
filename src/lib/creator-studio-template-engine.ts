import {
  CreatorStudioBriefSchema,
  CreatorStudioRenderPlanSchema,
  type CreatorStudioBrief,
  type CreatorStudioRenderPlan,
} from "./creator-studio.schema";

const TEMPLATE_REVISION = 1;

function templateKey(brief: CreatorStudioBrief) {
  return `${brief.goal.toLowerCase()}__${brief.style.toLowerCase()}__v${TEMPLATE_REVISION}`;
}

export function planCreatorStudioVideo(input: unknown): CreatorStudioRenderPlan {
  const brief = CreatorStudioBriefSchema.parse(input);
  const total = brief.durationSeconds;
  const cover = brief.assets.find((a) => a.kind === "COVER") ?? brief.assets[0];
  const screenshots = brief.assets.filter((a) => a.kind === "SCREENSHOT");
  const logo = brief.assets.find((a) => a.kind === "LOGO");

  const hook = Math.max(2, Math.round(total * 0.12));
  const cta = Math.max(3, Math.round(total * 0.18));
  const middle = total - hook - cta;
  const featureCount = Math.min(Math.max(screenshots.length, 1), total === 15 ? 2 : 4);
  const featureDuration = middle / featureCount;

  const scenes: CreatorStudioRenderPlan["scenes"] = [
    {
      key: "hook",
      startSeconds: 0,
      durationSeconds: hook,
      role: "HOOK",
      headline: brief.productTitle,
      assetId: cover?.id,
    },
  ];

  for (let i = 0; i < featureCount; i += 1) {
    const asset = screenshots[i] ?? cover;
    scenes.push({
      key: `feature-${i + 1}`,
      startSeconds: hook + i * featureDuration,
      durationSeconds: featureDuration,
      role: i === 0 ? "COVER" : "FEATURE",
      assetId: asset?.id,
    });
  }

  scenes.push({
    key: "cta",
    startSeconds: total - cta,
    durationSeconds: cta,
    role: "CTA",
    headline: brief.callToAction,
    assetId: logo?.id ?? cover?.id,
  });

  return CreatorStudioRenderPlanSchema.parse({
    schemaVersion: 1,
    templateKey: templateKey(brief),
    templateRevision: TEMPLATE_REVISION,
    durationSeconds: brief.durationSeconds,
    aspectRatio: "9:16",
    scenes,
  });
}
