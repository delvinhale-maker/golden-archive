import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCart } from "@/hooks/use-av-store";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "av:cart:session";
const REMINDER_KEY = "av:cart:reminder-shown";
const REMINDER_DELAY_MS = 10 * 60 * 1000; // 10 minutes

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (window.crypto?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Quietly syncs the active cart to `abandoned_carts` and fires a one-time
 * "still thinking it over?" toast after 10 minutes of inactivity.
 */
export function AbandonedCartTracker() {
  const cart = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastSyncRef = useRef<number>(0);
  const reminderRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist cart snapshot (debounced) to DB so we can recover later
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (cart.items.length === 0) return;
    // Don't sync while user is on cart/checkout pages
    if (pathname.startsWith("/cart") || pathname.startsWith("/checkout")) return;

    const handle = window.setTimeout(async () => {
      try {
        const sessionId = getSessionId();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user ?? null;
        await supabase.rpc("upsert_abandoned_cart", {
          _session_id: sessionId,
          _items: cart.items as never,
          _subtotal: cart.subtotal,
          _item_count: cart.count,
          _email: user?.email ?? undefined,
        });
        lastSyncRef.current = Date.now();
      } catch {
        // Non-blocking
      }
    }, 1500);

    return () => window.clearTimeout(handle);
  }, [cart.items, cart.subtotal, cart.count, pathname]);

  // Mark recovered when cart empties OR user lands on checkout return
  useEffect(() => {
    if (cart.items.length > 0) return;
    if (typeof window === "undefined") return;
    const sessionId = window.localStorage.getItem(SESSION_KEY);
    if (!sessionId) return;
    void supabase.rpc("mark_abandoned_cart_recovered", { _session_id: sessionId });
    window.sessionStorage.removeItem(REMINDER_KEY);
  }, [cart.items.length]);

  // 10-minute "come back" toast (once per session, only when items exist)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (reminderRef.current) {
      clearTimeout(reminderRef.current);
      reminderRef.current = null;
    }
    if (cart.items.length === 0) return;
    if (window.sessionStorage.getItem(REMINDER_KEY) === "1") return;
    if (pathname.startsWith("/cart") || pathname.startsWith("/checkout")) return;

    reminderRef.current = setTimeout(() => {
      window.sessionStorage.setItem(REMINDER_KEY, "1");
      toast("Still thinking it over?", {
        description: `You have ${cart.count} item${cart.count === 1 ? "" : "s"} waiting in your cart.`,
        action: {
          label: "View cart",
          onClick: () => {
            window.location.href = "/cart";
          },
        },
        duration: 12000,
      });
    }, REMINDER_DELAY_MS);

    return () => {
      if (reminderRef.current) clearTimeout(reminderRef.current);
    };
  }, [cart.items.length, cart.count, pathname]);

  return null;
}
