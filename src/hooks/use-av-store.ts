import { useEffect, useState, useCallback } from "react";

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

function useLocalSet(key: string) {
  const [set, setSet] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSet(readSet(key));
    const handler = () => setSet(readSet(key));
    window.addEventListener(`av:storage:${key}`, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(`av:storage:${key}`, handler);
      window.removeEventListener("storage", handler);
    };
  }, [key]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(readSet(key));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(key, next);
    },
    [key],
  );

  const has = useCallback((id: string) => set.has(id), [set]);

  return { count: set.size, has, toggle };
}

export const useWishlist = () => useLocalSet(WISHLIST_KEY);

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
