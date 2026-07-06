// Lightweight instrumentation for the EPUB previewer's arrow navigation.
// Detects the two regressions we've already had to fix:
//   1. Arrow tap → rendition remount / stuck busy (unlock timer fires)
//   2. Page-step miscalculation (a single tap advances by more than 1 page,
//      or moves in the opposite direction of the tap)
//
// Emits console.warn on anomalies and keeps a ring buffer at
// window.__epubNavDiag for quick inspection during QA. No network calls,
// no user-facing UI — purely a dev/QA aid safe to leave in production.

type NavEvent =
  | { t: number; kind: "tap"; dir: 1 | -1; from: number }
  | { t: number; kind: "relocated"; to: number; from: number; pendingStep: 1 | -1 | null }
  | { t: number; kind: "unlock_timeout"; pendingStep: 1 | -1 | null }
  | { t: number; kind: "remount" }
  | { t: number; kind: "anomaly"; reason: string; detail?: unknown };

const BUFFER_MAX = 50;

declare global {
  interface Window {
    __epubNavDiag?: {
      events: NavEvent[];
      remounts: number;
      anomalies: number;
    };
  }
}

function store() {
  if (typeof window === "undefined") return null;
  if (!window.__epubNavDiag) {
    window.__epubNavDiag = { events: [], remounts: 0, anomalies: 0 };
  }
  return window.__epubNavDiag;
}

function push(evt: NavEvent) {
  const s = store();
  if (!s) return;
  s.events.push(evt);
  if (s.events.length > BUFFER_MAX) s.events.splice(0, s.events.length - BUFFER_MAX);
}

let lastTap: { dir: 1 | -1; from: number; at: number } | null = null;

export function recordMount() {
  const s = store();
  if (!s) return;
  s.remounts += 1;
  push({ t: Date.now(), kind: "remount" });
  // First mount is normal; anything after that during a single previewer
  // session likely indicates React re-mount churn that can strand nav state.
  if (s.remounts > 1) {
    s.anomalies += 1;
    console.warn(
      "[epub-nav] previewer remounted mid-session",
      { totalMounts: s.remounts },
    );
  }
}

export function recordTap(dir: 1 | -1, from: number) {
  lastTap = { dir, from, at: Date.now() };
  push({ t: lastTap.at, kind: "tap", dir, from });
}

export function recordRelocated(
  to: number,
  from: number,
  pendingStep: 1 | -1 | null,
) {
  push({ t: Date.now(), kind: "relocated", to, from, pendingStep });
  if (!lastTap) return;
  const delta = to - from;
  const expected = lastTap.dir;
  // Only assert on relocations we can attribute to the last tap (within 4s
  // and starting from the tap's `from` page).
  if (Date.now() - lastTap.at > 4000) { lastTap = null; return; }
  if (from !== lastTap.from) return;

  let reason: string | null = null;
  if (delta === 0) {
    reason = "no page change after arrow tap";
  } else if (Math.sign(delta) !== expected) {
    reason = "page moved opposite to arrow direction";
  } else if (Math.abs(delta) > 1) {
    reason = `page jumped by ${delta} instead of ${expected}`;
  }
  if (reason) {
    const s = store();
    if (s) s.anomalies += 1;
    console.warn("[epub-nav] anomaly:", reason, { from, to, dir: expected });
    push({ t: Date.now(), kind: "anomaly", reason, detail: { from, to, dir: expected } });
  }
  lastTap = null;
}

export function recordUnlockTimeout(pendingStep: 1 | -1 | null) {
  const s = store();
  if (s) s.anomalies += 1;
  push({ t: Date.now(), kind: "unlock_timeout", pendingStep });
  console.warn(
    "[epub-nav] nav unlock timeout fired — rendition never emitted 'relocated'",
    { pendingStep },
  );
}
