/**
 * Affiliate row rotation.
 *
 * Affiliate rows keep the admin-defined `sort_order` as their base order; this
 * helper only rotates the starting offset so the same pool surfaces different
 * items every 12 hours (00:00 and 12:00 UTC).
 */

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/** Stable slot index that advances once every 12 hours (UTC-aligned). */
export function halfDaySlot(now: Date = new Date()): number {
  return Math.floor(now.getTime() / TWELVE_HOURS_MS);
}

/**
 * Rotate a base-ordered pool by the current 12h slot.
 * `salt` offsets different rows so they don't all show the same head item.
 */
export function rotateHalfDay<T>(
  pool: T[],
  salt = 0,
  count?: number,
  now: Date = new Date(),
): T[] {
  if (pool.length === 0) return [];
  const take = Math.min(count ?? pool.length, pool.length);
  const start = ((halfDaySlot(now) + salt) % pool.length + pool.length) % pool.length;
  const out: T[] = [];
  for (let i = 0; i < take; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}
