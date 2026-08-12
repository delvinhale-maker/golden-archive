import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "av_session_id";

/** Stable per-device id so repeat visits can be grouped later. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `s_${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Fire-and-forget CTA click log. Never awaited by the UI and never throws —
 * analytics must not delay or break the scroll/submit behaviour.
 */
export function logCtaClick(ctaLocation: string) {
  try {
    void supabase
      .from("cta_click_events")
      .insert({
        session_id: getSessionId(),
        cta_location: ctaLocation,
        page_path: typeof window !== "undefined" ? window.location.pathname : null,
      })
      .then(({ error }) => {
        if (error) console.warn("CTA click log failed:", error.message);
      });
  } catch {
    /* ignore */
  }
}
