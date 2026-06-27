// Client-side referral capture + storage.
//
// On any page load we look for `?ref=CODE` in the URL and persist it for 90
// days in localStorage. Signup and checkout both read the stored code so the
// referrer gets attribution even if the user lands first, browses, and only
// later creates an account or buys.

const STORAGE_KEY = "av_ref";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-Z0-9]{6,16}$/;

type Stored = { code: string; at: number; source?: string };

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function captureRefFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("ref");
    if (!raw) return getStoredRef();
    const code = raw.trim().toUpperCase();
    if (!CODE_RE.test(code)) return getStoredRef();
    const store = safeStorage();
    if (store) {
      const existing = readStored(store);
      // First-touch attribution: don't overwrite an existing fresh code.
      if (!existing || Date.now() - existing.at > TTL_MS) {
        const payload: Stored = { code, at: Date.now(), source: document.referrer || undefined };
        store.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
    }
    return code;
  } catch {
    return null;
  }
}

function readStored(store: Storage): Stored | null {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.code || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > TTL_MS) {
      store.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredRef(): string | null {
  const store = safeStorage();
  if (!store) return null;
  return readStored(store)?.code ?? null;
}

export function getStoredRefSource(): string | null {
  const store = safeStorage();
  if (!store) return null;
  return readStored(store)?.source ?? null;
}

export function clearStoredRef(): void {
  const store = safeStorage();
  store?.removeItem(STORAGE_KEY);
}
