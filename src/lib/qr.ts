/**
 * AurumVault QR Business System — pure, dependency-free core.
 *
 * Destination validation, public-id generation, and style/contrast safety
 * live here so they can be unit-tested directly (no Supabase, no QR
 * rendering library) and reused identically by both the create and update
 * server functions in qr.functions.ts. Client-side validation is
 * convenience only — every one of these functions runs again server-side
 * before any write, per the Phase 1 authorization.
 */

export const SITE_URL = "https://www.aurumvault.store";

/** Configurable Phase 1 usage limit — not a permanent pricing promise. */
export const MAX_ACTIVE_DYNAMIC_QR = 3;

export const QR_MODES = ["static", "dynamic"] as const;
export type QrMode = (typeof QR_MODES)[number];

export const QR_STATUSES = ["active", "paused", "archived"] as const;
export type QrStatus = (typeof QR_STATUSES)[number];

/** Phase 1 destination types. Wi-Fi/geo/document payloads are deferred. */
export const QR_DESTINATION_TYPES = ["url", "email", "tel", "sms", "text"] as const;
export type QrDestinationType = (typeof QR_DESTINATION_TYPES)[number];

/**
 * Destination types a dynamic QR can use. "text" is excluded — there is no
 * browser action to redirect to for plain text, so it's static-only. Kept
 * as its own list (rather than a filter at every call site) so the create
 * wizard's dynamic-mode destination picker and the server functions' write
 * guard both read from one place.
 */
export const DYNAMIC_QR_DESTINATION_TYPES = QR_DESTINATION_TYPES.filter(
  (t) => t !== "text",
) as Exclude<QrDestinationType, "text">[];

export type DestinationValidation = { ok: true; payload: string } | { ok: false; reason: string };

/** Strip control characters (0x00-0x1F, 0x7F) except plain spaces. */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1f\x7f]/g, "");
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
// Digits, spaces, and the limited punctuation real phone numbers use.
const PHONE_RE = /^[+()\-.\s0-9]{5,25}$/;

/**
 * Validate and normalize a destination payload for a given type. Returns
 * the exact string that gets stored (and, for static mode, encoded) — never
 * the raw client input.
 */
export function validateDestination(
  type: QrDestinationType,
  rawInput: string,
): DestinationValidation {
  const raw = stripControlChars((rawInput ?? "").trim());
  if (!raw) return { ok: false, reason: "Enter a destination." };
  if (raw.length > 2000) return { ok: false, reason: "That's too long for a QR code." };

  switch (type) {
    case "url": {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return { ok: false, reason: "Enter a full web address, like https://example.com." };
      }
      // https-only, matching the safeExternalUrl convention used elsewhere
      // in this codebase (storefront.ts) — javascript:, data:, file:, and
      // protocol-relative tricks are all rejected by construction, since
      // only an exact "https:" protocol ever passes.
      if (url.protocol !== "https:") {
        return { ok: false, reason: "Only secure https:// links are supported." };
      }
      if (!url.hostname.includes(".")) {
        return { ok: false, reason: "Enter a full web address, like https://example.com." };
      }
      return { ok: true, payload: url.toString() };
    }
    case "email": {
      if (!EMAIL_RE.test(raw)) return { ok: false, reason: "Enter a valid email address." };
      return { ok: true, payload: `mailto:${raw}` };
    }
    case "tel": {
      if (!PHONE_RE.test(raw)) return { ok: false, reason: "Enter a valid phone number." };
      return { ok: true, payload: `tel:${raw.replace(/[()\-.\s]/g, "")}` };
    }
    case "sms": {
      if (!PHONE_RE.test(raw)) return { ok: false, reason: "Enter a valid phone number." };
      return { ok: true, payload: `sms:${raw.replace(/[()\-.\s]/g, "")}` };
    }
    case "text": {
      if (raw.length > 500) return { ok: false, reason: "Keep plain text under 500 characters." };
      return { ok: true, payload: raw };
    }
    default:
      return { ok: false, reason: "Unsupported destination type." };
  }
}

/**
 * The AurumVault-controlled redirect URL a dynamic QR actually encodes.
 * Never the raw destination — that's what makes it editable without
 * reprinting. Base URL matches the literal SITE_URL constant used
 * throughout the rest of this codebase (products.$id.tsx,
 * founding.server.ts, etc.) rather than an env var, so a dynamic QR never
 * accidentally encodes a staging/preview origin.
 */
export function buildDynamicQrUrl(publicId: string): string {
  return `${SITE_URL}/q/${publicId}`;
}

/** 160 bits of CSPRNG entropy, hex-encoded — non-sequential, unguessable. */
export function generateQrPublicId(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export type QrColorValidation =
  | { ok: true; foreground: string; background: string }
  | { ok: false; reason: string };

/**
 * Enforce Section 19's scannability rules: solid 6-digit hex colors only
 * (no alpha/transparency channel — a transparent foreground is explicitly
 * disallowed), and a contrast ratio floor between foreground and
 * background. A QR code with insufficient contrast will not reliably scan
 * regardless of how it looks on screen.
 */
export function validateQrColors(
  foregroundInput: string | undefined,
  backgroundInput: string | undefined,
): QrColorValidation {
  const foreground = (foregroundInput || "#000000").trim();
  const background = (backgroundInput || "#FFFFFF").trim();

  if (!HEX_COLOR_RE.test(foreground)) {
    return { ok: false, reason: "Foreground color must be a solid hex color, like #1A2E4A." };
  }
  if (!HEX_COLOR_RE.test(background)) {
    return { ok: false, reason: "Background color must be a solid hex color, like #FFFFFF." };
  }

  const ratio = contrastRatio(foreground, background);
  // WCAG AA text contrast (4.5:1) is a reasonable, well-established floor
  // for "reliably distinguishable dark vs. light modules" — QR scanners
  // are more forgiving than human text reading, but this stays a safe,
  // conservative default rather than the bare minimum that still decodes.
  if (ratio < 4.5) {
    return {
      ok: false,
      reason: "These colors are too close in brightness for a QR code to scan reliably.",
    };
  }

  return { ok: true, foreground, background };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** Standard WCAG relative-luminance contrast ratio, range [1, 21]. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export const QR_SIZE_PRESETS = {
  small: 256,
  standard: 512,
  print: 1024,
} as const;
export type QrSizePreset = keyof typeof QR_SIZE_PRESETS;

export function resolveQrSizePx(preset: string | undefined): number {
  if (preset && preset in QR_SIZE_PRESETS) return QR_SIZE_PRESETS[preset as QrSizePreset];
  return QR_SIZE_PRESETS.standard;
}
