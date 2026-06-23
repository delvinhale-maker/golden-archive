import { useEffect, useState, useCallback } from "react";

const WISHLIST_KEY = "av:wishlist";
const CART_KEY = "av:cart";

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
export const useCart = () => useLocalSet(CART_KEY);
