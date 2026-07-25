import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HomepageLayoutKind = "section" | "affiliate";

export type HomepageLayoutItem = {
  key: string;
  kind: HomepageLayoutKind;
  position: number;
  enabled: boolean;
  label: string;
};

export type HomepageLayout = {
  sections: HomepageLayoutItem[];
  affiliates: HomepageLayoutItem[];
};

function publicServerClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getHomepageLayout = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomepageLayout> => {
    try {
      const supa = publicServerClient();
      const { data, error } = await supa
        .from("homepage_layout")
        .select("key,kind,position,enabled,label")
        .order("kind", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as HomepageLayoutItem[];
      return {
        sections: rows.filter((r) => r.kind === "section"),
        affiliates: rows.filter((r) => r.kind === "affiliate"),
      };
    } catch (e) {
      console.error("[getHomepageLayout] failed:", e);
      return { sections: [], affiliates: [] };
    }
  },
);

const SaveInput = z.object({
  kind: z.enum(["section", "affiliate"]),
  orderedKeys: z.array(z.string().min(1)).max(64),
});

export const saveHomepageLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    // Assign new positions in step-10 increments so future manual inserts stay tidy.
    let pos = 10;
    for (const key of data.orderedKeys) {
      const { error } = await supabase
        .from("homepage_layout")
        .update({ position: pos })
        .eq("key", key)
        .eq("kind", data.kind);
      if (error) throw error;
      pos += 10;
    }
    return { ok: true };
  });
