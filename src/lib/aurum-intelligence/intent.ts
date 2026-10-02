import type { AurumIntent } from "./contracts";

const ACTION_WORDS = /\b(start|build|create|launch|sell|grow|fix|improve|learn|find|choose|compare|plan|track|manage|price|market)\b/i;
const BUY_WORDS = /\b(buy|purchase|need today|ready to buy|checkout)\b/i;
const EXECUTE_WORDS = /\b(do it|set it up|implement|execute|complete|finish)\b/i;

export function normalizeObjective(input: string): string {
  return input.trim().replace(/\s+/g, " ").replace(/^(i need|i want|help me|can you help me)\s+/i, "").slice(0, 500);
}

export function classifyStage(input: string): AurumIntent["stage"] {
  if (EXECUTE_WORDS.test(input)) return "executing";
  if (BUY_WORDS.test(input)) return "buying";
  if (ACTION_WORDS.test(input)) return "planning";
  return "exploring";
}

export function extractNeeds(input: string): string[] {
  const clean = input.trim().replace(/\s+/g, " ");
  const chunks = clean.split(/[,;]|\band\b|\bbut\b/i).map((v) => v.trim()).filter(Boolean);
  return [...new Set(chunks)].slice(0, 12);
}

export function buildDeterministicIntent(args: {
  sessionId: string;
  channel: "text" | "voice";
  rawInput: string;
  analyticsConsent?: boolean;
  personalizationConsent?: boolean;
}): AurumIntent {
  const objective = normalizeObjective(args.rawInput);
  return {
    sessionId: args.sessionId,
    channel: args.channel,
    rawInput: args.rawInput.trim(),
    objective,
    needs: extractNeeds(args.rawInput),
    constraints: [],
    stage: classifyStage(args.rawInput),
    categoryHints: [],
    confidence: objective.length >= 12 ? 0.7 : 0.45,
    consent: {
      analytics: args.analyticsConsent ?? false,
      personalization: args.personalizationConsent ?? false,
    },
  };
}
