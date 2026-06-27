import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const WISHLIST_KEY = "av:wishlist";
const CART_KEY = "av:cart:v2";

/* ------------------------------ Wishlist (Set) ------------------------------ */

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, s: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify([...s]));
  window.dispatchEvent(new CustomEvent(`av:storage:${key}`));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useWishlist() {
  const key = WISHLIST_KEY;
  const [set, setSet] = useState<Set<string>>(() => new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async (uid: string | null) => {
      if (cancelled) return;
      setUserId(uid);
      if (!uid) {
        setSet(readSet(key));
        return;
      }
      const { data } = await supabase.from("wishlists").select("product_id");
      if (cancelled) return;
      const ids = new Set((data ?? []).map((r) => r.product_id as string));
      const local = readSet(key);
      const toUpload = [...local].filter((id) => !ids.has(id) && UUID_RE.test(id));
      if (toUpload.length) {
        await supabase
          .from("wishlists")
          .insert(toUpload.map((pid) => ({ user_id: uid, product_id: pid })));
        toUpload.forEach((id) => ids.add(id));
      }
      writeSet(key, ids);
      setSet(ids);
    };
    supabase.auth.getUser().then(({ data }) => hydrate(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      hydrate(session?.user?.id ?? null);
    });
    const handler = () => setSet(readSet(key));
    window.addEventListener(`av:storage:${key}`, handler);
    window.addEventListener("storage", handler);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener(`av:storage:${key}`, handler);
      window.removeEventListener("storage", handler);
    };
  }, [key]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(readSet(key));
      const adding = !next.has(id);
      if (adding) next.add(id);
      else next.delete(id);
      writeSet(key, next);
      setSet(next);
      if (userId && UUID_RE.test(id)) {
        if (adding) {
          void supabase
            .from("wishlists")
            .insert({ user_id: userId, product_id: id });
        } else {
          void supabase
            .from("wishlists")
            .delete()
            .eq("user_id", userId)
            .eq("product_id", id);
        }
      }
    },
    [key, userId],
  );

  const has = useCallback((id: string) => set.has(id), [set]);

  return { count: set.size, has, toggle };
}

/* ------------------------------ Cart (items + qty) ------------------------------ */

export type CartItem = {
  id: string;
  title: string;
  price: number;
  category: string;
  image?: string;
  qty: number;
};

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CartItem[];
    return Array.isArray(arr) ? arr.filter((i) => i && i.id) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("av:storage:cart"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => []);

  useEffect(() => {
    setItems(readCart());
    const handler = () => setItems(readCart());
    window.addEventListener("av:storage:cart", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("av:storage:cart", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    const current = readCart();
    const idx = current.findIndex((i) => i.id === item.id);
    if (idx >= 0) current[idx] = { ...current[idx], qty: current[idx].qty + qty };
    else current.push({ ...item, qty });
    writeCart(current);
    window.dispatchEvent(new CustomEvent("av:cart:open"));
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    const current = readCart()
      .map((i) => (i.id === id ? { ...i, qty: Math.max(0, qty) } : i))
      .filter((i) => i.qty > 0);
    writeCart(current);
  }, []);

  const remove = useCallback((id: string) => {
    writeCart(readCart().filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => writeCart([]), []);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  return { items, count, subtotal, add, setQty, remove, clear, has };
}

export function openCartDrawer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("av:cart:open"));
}
