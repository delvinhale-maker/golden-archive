import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
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

export const Route = createFileRoute("/api/ai-studio-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !publishableKey) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const supabase = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed: z.infer<typeof InputSchema>;
        try {
          parsed = InputSchema.parse(await request.json());
        } catch {
          return new Response("Invalid input", { status: 400 });
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
        }

        const system = [
          "You are AurumVault AI Studio — a premium creative assistant for AurumVault marketplace creators.",
          "Write in clear, high-conversion, on-brand copy tailored to the requested category and tool.",
          `Category: ${parsed.category}. Tool: ${parsed.tool}.`,
          parsed.tone ? `Tone: ${parsed.tone}.` : "",
          parsed.audience ? `Target audience: ${parsed.audience}.` : "",
          lengthGuidance(parsed.length),
          "Format lists with markdown bullets. Use short paragraphs. Never invent facts about real people.",
          parsed.systemHint ?? "",
        ]
          .filter(Boolean)
          .join(" ");

        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens:
              parsed.length === "long" ? 4000 : parsed.length === "short" ? 800 : 2000,
            system,
            stream: true,
            messages: [{ role: "user", content: parsed.prompt }],
          }),
          signal: request.signal,
        });

        if (!upstream.ok || !upstream.body) {
          const errText = await upstream.text().catch(() => "");
          return new Response(
            `Anthropic API error (${upstream.status}): ${errText.slice(0, 500) || upstream.statusText}`,
            { status: 502 },
          );
        }

        // Transform Anthropic SSE into a plain text token stream for the client.
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = upstream.body.getReader();

        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            let buffered = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  return;
                }
                buffered += decoder.decode(value, { stream: true });
                let idx: number;
                while ((idx = buffered.indexOf("\n")) !== -1) {
                  const line = buffered.slice(0, idx).trim();
                  buffered = buffered.slice(idx + 1);
                  if (!line.startsWith("data:")) continue;
                  const payload = line.slice(5).trim();
                  if (!payload || payload === "[DONE]") continue;
                  try {
                    const evt = JSON.parse(payload) as {
                      type?: string;
                      delta?: { type?: string; text?: string };
                    };
                    if (
                      evt.type === "content_block_delta" &&
                      evt.delta?.type === "text_delta" &&
                      typeof evt.delta.text === "string"
                    ) {
                      controller.enqueue(encoder.encode(evt.delta.text));
                    }
                  } catch {
                    /* ignore malformed line */
                  }
                }
              }
            } catch (err) {
              controller.error(err);
            }
          },
          cancel() {
            reader.cancel().catch(() => {});
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});
