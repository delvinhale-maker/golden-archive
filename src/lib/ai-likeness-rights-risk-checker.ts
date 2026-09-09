export type RightsAnswer = "yes" | "not_sure" | "no";

export type RightsQuestion = {
  id: string;
  question: string;
  gapLabel: string;
  guidance: string;
};

export const RIGHTS_QUESTIONS: RightsQuestion[] = [
  {
    id: "identity_scope",
    question:
      "Have you documented which parts of your identity or work you want to control, such as your face, voice, likeness, name, content, avatar or digital replica?",
    gapLabel: "Identity and asset scope",
    guidance:
      "Create a clear inventory of the identity elements and creative assets you want agreements and permissions to address.",
  },
  {
    id: "ai_training",
    question:
      "Do your agreements distinguish ordinary campaign use from AI training or model-training permission?",
    gapLabel: "AI training permission",
    guidance:
      "Separate ordinary content usage from permission to train, fine-tune or improve an AI model whenever that distinction matters.",
  },
  {
    id: "synthetic_uses",
    question:
      "Are voice cloning, synthetic voice, avatar or digital-replica use, and synthetic-video permissions addressed explicitly?",
    gapLabel: "Synthetic media permissions",
    guidance:
      "Document whether synthetic voice, likeness, avatar and video uses are allowed, restricted or require additional approval.",
  },
  {
    id: "scope_limits",
    question:
      "Are permitted purpose, platforms, territory and duration documented?",
    gapLabel: "Purpose, platform, territory and term",
    guidance:
      "Record where, why and for how long a permission applies instead of relying on an open-ended authorization.",
  },
  {
    id: "sublicensing",
    question:
      "Do you know whether the license can be sublicensed or transferred to third parties?",
    gapLabel: "Sublicensing and transfer",
    guidance:
      "Clarify whether another party can pass your permission to affiliates, vendors, partners, models or other third parties.",
  },
  {
    id: "approval",
    question:
      "Is there an approval process for synthetic or AI-generated outputs before publication?",
    gapLabel: "Output approval",
    guidance:
      "Define who reviews synthetic outputs, what requires approval and how rejected or corrected outputs are handled.",
  },
  {
    id: "evidence",
    question:
      "Do you retain copies or evidence of consent, contracts, versions and later changes?",
    gapLabel: "Consent and evidence trail",
    guidance:
      "Keep dated evidence of permissions, agreements, versions, approvals and material changes in one retrievable system.",
  },
  {
    id: "expiration",
    question:
      "Are expiration, renewal, revocation, reversion or takedown procedures documented where applicable?",
    gapLabel: "Expiration and exit controls",
    guidance:
      "Document what happens when permission ends, changes, is not renewed or requires content to be removed or replaced.",
  },
  {
    id: "compensation",
    question:
      "Are compensation or royalty terms separated from the scope of permission where relevant?",
    gapLabel: "Compensation versus permission",
    guidance:
      "Track payment terms separately from what uses are actually permitted so money and authorization are not conflated.",
  },
  {
    id: "future_use",
    question:
      "Have you documented preferences or instructions for future or posthumous digital-identity use where relevant?",
    gapLabel: "Future digital-identity instructions",
    guidance:
      "Consider documenting how future, archival or posthumous digital-identity requests should be reviewed and who can act on them.",
  },
];

export const ANSWER_POINTS: Record<RightsAnswer, number> = {
  yes: 0,
  not_sure: 1,
  no: 2,
};

export type RightsReadinessBand =
  | "stronger_foundation"
  | "needs_clarification"
  | "high_documentation_gap";

export type RightsReadinessResult = {
  score: number;
  answeredCount: number;
  band: RightsReadinessBand;
  label: string;
  summary: string;
  gaps: Array<{
    id: string;
    points: number;
    label: string;
    guidance: string;
  }>;
};

export function rightsReadinessBand(score: number): RightsReadinessResult["band"] {
  if (score <= 5) return "stronger_foundation";
  if (score <= 12) return "needs_clarification";
  return "high_documentation_gap";
}

export function scoreRightsReadiness(
  answers: Partial<Record<string, RightsAnswer>>,
): RightsReadinessResult {
  const scored = RIGHTS_QUESTIONS.flatMap((q) => {
    const answer = answers[q.id];
    if (!answer) return [];
    return [
      {
        id: q.id,
        points: ANSWER_POINTS[answer],
        label: q.gapLabel,
        guidance: q.guidance,
      },
    ];
  });

  const score = scored.reduce((sum, item) => sum + item.points, 0);
  const band = rightsReadinessBand(score);

  const copy = {
    stronger_foundation: {
      label: "Stronger documentation foundation",
      summary:
        "Your answers indicate that several core permissions and documentation controls are already defined. Review any remaining uncertain areas and keep your records current.",
    },
    needs_clarification: {
      label: "Several controls need clarification",
      summary:
        "Your answers show a workable starting point, but several permissions, evidence or lifecycle controls would benefit from clearer documentation.",
    },
    high_documentation_gap: {
      label: "High documentation and control gap",
      summary:
        "Many important permissions or records are not yet clearly documented. Prioritize the highest-gap areas before relying on informal assumptions.",
    },
  }[band];

  const gaps = scored
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return {
    score,
    answeredCount: scored.length,
    band,
    label: copy.label,
    summary: copy.summary,
    gaps,
  };
}
