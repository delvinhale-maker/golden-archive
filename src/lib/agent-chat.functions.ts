import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  conversation_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  user_message: z.string().min(1).max(20000),
});

export type AgentChatInput = z.infer<typeof InputSchema>;

const DEFAULT_MODEL = "claude-sonnet-4-6";

export const agentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

    // 1. Agent persona + model
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("id, name, role, persona_prompt, model, is_active")
      .eq("id", data.agent_id)
      .maybeSingle();
    if (agentErr) throw new Error(agentErr.message);
    if (!agent) throw new Error("Agent not found.");

    // 2. Save the incoming user message
    const { error: insertErr } = await supabase.from("messages").insert({
      conversation_id: data.conversation_id,
      agent_id: agent.id,
      role: "user",
      content: data.user_message,
    });
    if (insertErr) throw new Error(insertErr.message);

    // 3. Last 20 messages for context
    const { data: recent, error: histErr } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (histErr) throw new Error(histErr.message);

    const history = (recent ?? [])
      .slice()
      .reverse()
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }))
      .filter((m) => m.content.trim().length > 0);

    // 4. 10 most recent memory rows for this agent
    const { data: memory } = await supabase
      .from("agent_memory")
      .select("content, source_type, created_at")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const memoryBlock =
      memory && memory.length > 0
        ? `\n\nRelevant memory (most recent first):\n${memory
            .map((m, i) => `${i + 1}. [${m.source_type ?? "note"}] ${m.content}`)
            .join("\n")}`
        : "";

    const system = `${agent.persona_prompt}${memoryBlock}`;

    // 5. Call Anthropic
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: agent.model || DEFAULT_MODEL,
        max_tokens: 2000,
        system,
        messages: history.length > 0 ? history : [{ role: "user", content: data.user_message }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Anthropic API error (${res.status}): ${errText.slice(0, 500) || res.statusText}`,
      );
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const reply =
      json.content
        ?.filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("\n\n")
        .trim() ?? "";

    // 6. Save the agent reply
    if (reply) {
      const { error: replyErr } = await supabase.from("messages").insert({
        conversation_id: data.conversation_id,
        agent_id: agent.id,
        role: "assistant",
        content: reply,
      });
      if (replyErr) throw new Error(replyErr.message);
    }

    // 7. Return JSON
    return {
      reply,
      agent: { id: agent.id, name: agent.name, model: agent.model || DEFAULT_MODEL },
      conversation_id: data.conversation_id,
    };
  });
