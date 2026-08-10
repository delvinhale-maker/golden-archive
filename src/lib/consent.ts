/**
 * Minimal cookie-consent state. Essential cookies (session, cart) always run;
 * non-essential (advertising/analytics) scripts only load after "accepted".
 */
export type ConsentValue = "accepted" | "rejected";

export const CONSENT_STORAGE_KEY = "av_cookie_consent";
export const CONSENT_EVENT = "av:cookie-consent";
export const CONSENT_OPEN_EVENT = "av:cookie-consent-open";

export function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: ConsentValue) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    /* storage blocked — consent stays session-only */
  }
  window.dispatchEvent(new CustomEvent<ConsentValue>(CONSENT_EVENT, { detail: value }));
}

/** Lets any page (e.g. the Privacy Policy) reopen the banner. */
export function openConsentSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
