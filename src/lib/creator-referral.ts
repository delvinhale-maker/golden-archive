// Client-side capture of a creator-recruits-creator referral code.
// Stored separately from the buyer `?ref=` code so the two don't collide.

const STORAGE_KEY = "av_cref";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-Z0-9]{6,16}$/;

type Stored = { code: string; at: number };

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(store: Storage): Stored | null {
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

export function captureCreatorRefFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("cref");
    if (!raw) return getStoredCreatorRef();
    const code = raw.trim().toUpperCase();
    if (!CODE_RE.test(code)) return getStoredCreatorRef();
    const store = safeStorage();
    if (store) {
      const existing = read(store);
      if (!existing || Date.now() - existing.at > TTL_MS) {
        store.setItem(STORAGE_KEY, JSON.stringify({ code, at: Date.now() } satisfies Stored));
      }
    }
    return code;
  } catch {
    return null;
  }
}

export function getStoredCreatorRef(): string | null {
  const store = safeStorage();
  if (!store) return null;
  return read(store)?.code ?? null;
}

export function clearStoredCreatorRef(): void {
  safeStorage()?.removeItem(STORAGE_KEY);
}
