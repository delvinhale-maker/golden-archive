import { z } from "zod";

/** Server-side validation for Starter Pack lead capture. Client-safe module. */
export const starterPackSubmitSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name").max(80),
  email: z.string().trim().min(3).max(255).email(),
  marketingConsent: z.boolean().optional().default(false),
  /** Honeypot — bots that autofill it get a silent fake success. */
  company: z.string().max(200).optional().default(""),
  /** Milliseconds spent on the form; sub-second fills are automated. */
  elapsedMs: z.number().int().min(0).max(86_400_000).optional().default(0),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(160).optional(),
  utmContent: z.string().trim().max(160).optional(),
  utmTerm: z.string().trim().max(160).optional(),
  referringUrl: z.string().trim().max(500).optional(),
  landingPage: z.string().trim().max(500).optional(),
});

export type StarterPackSubmitInput = z.infer<typeof starterPackSubmitSchema>;

/** Forms filled faster than this are almost certainly automated. */
export const MIN_FILL_MS = 1200;
/** Max Starter Pack requests accepted per hour from one visitor fingerprint. */
export const MAX_PER_HOUR = 5;

export function normalizeLeadEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strips CR/LF/TAB so nothing a visitor types can inject an email header. */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim();
}

/** True when the submission looks automated (honeypot filled or filled too fast). */
export function looksAutomated(input: { company?: string; elapsedMs?: number }): boolean {
  return (input.company ?? "").trim().length > 0 || (input.elapsedMs ?? 0) < MIN_FILL_MS;
}
