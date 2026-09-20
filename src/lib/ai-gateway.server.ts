import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function createIndependentAiProvider() {
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY or OPENAI_API_KEY is not configured");
  }

  return createOpenAICompatible({
    name: "aurumvault-ai",
    baseURL: process.env.AI_GATEWAY_BASE_URL ?? "https://api.openai.com/v1",
    apiKey,
  });
}

export function getAiReviewModelId(): string {
  return process.env.AI_REVIEW_MODEL ?? "gpt-4.1-mini";
}

export function assertIndependentAiConfigured(): void {
  void requiredEnv;
  if (!(process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY)) {
    throw new Error("AI provider is not configured");
  }
}
