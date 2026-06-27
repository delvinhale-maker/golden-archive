import { useCallback, useEffect, useState } from "react";

const KEY = "av:recently-viewed";
const MAX = 12;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  window.dispatchEvent(new CustomEvent("av:recently-viewed"));
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(read());
    const h = () => setIds(read());
    window.addEventListener("av:recently-viewed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("av:recently-viewed", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return ids;
}

export function useTrackView(productId: string | undefined | null) {
  useEffect(() => {
    if (!productId) return;
    const next = [productId, ...read().filter((x) => x !== productId)];
    write(next);
  }, [productId]);
}

export function clearRecentlyViewed() {
  write([]);
}

export const _useNoop = useCallback;
