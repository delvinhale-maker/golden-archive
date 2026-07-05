import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  category: z.string().min(1).max(64),
  tool: z.string().min(1).max(80),
  prompt: z.string().min(1).max(8000),
  tone: z.string().max(64).optional(),
  audience: z.string().max(64).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
  systemHint: z.string().max(2000).optional(),
});

export type AiStudioInput = z.infer<typeof InputSchema>;

function lengthGuidance(length?: "short" | "medium" | "long") {
  switch (length) {
    case "short":
      return "Keep the response concise (roughly 80–160 words or 5–8 items).";
    case "long":
      return "Provide a thorough, in-depth response (roughly 600–1200 words).";
    case "medium":
    default:
      return "Aim for a balanced response (roughly 250–450 words).";
  }
}

export const generateAiStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }

    const system = [
      "You are AurumVault AI Studio — a premium creative assistant for AurumVault marketplace creators.",
      "Write in clear, high-conversion, on-brand copy tailored to the requested category and tool.",
      `Category: ${data.category}. Tool: ${data.tool}.`,
      data.tone ? `Tone: ${data.tone}.` : "",
      data.audience ? `Target audience: ${data.audience}.` : "",
      lengthGuidance(data.length),
      "Format lists with markdown bullets. Use short paragraphs. Never invent facts about real people.",
      data.systemHint ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: data.length === "long" ? 4000 : data.length === "short" ? 800 : 2000,
        system,
        messages: [{ role: "user", content: data.prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Anthropic API error (${res.status}): ${errText.slice(0, 500) || res.statusText}`,
      );
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      json.content
        ?.filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("\n\n") ?? "";

    return { text };
  });
