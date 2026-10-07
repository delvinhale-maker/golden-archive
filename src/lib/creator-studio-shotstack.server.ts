import { z } from "zod";

const SubmitResponseSchema = z.object({
  success: z.boolean(),
  response: z.object({ id: z.string().uuid() }),
});

const StatusResponseSchema = z.object({
  success: z.boolean(),
  response: z.object({
    id: z.string().uuid(),
    status: z.enum(["queued", "fetching", "preprocessing", "rendering", "saving", "done", "failed"]),
    url: z.string().url().optional(),
    error: z.string().nullable().optional(),
  }),
});

export type ShotstackEnvironment = "stage" | "v1";

function environment(): ShotstackEnvironment {
  return process.env.CREATOR_STUDIO_SHOTSTACK_PRODUCTION_ENABLED === "true" ? "v1" : "stage";
}

function credentials() {
  const env = environment();
  const key = env === "v1" ? process.env.SHOTSTACK_API_KEY : process.env.SHOTSTACK_STAGE_API_KEY;
  if (!key) throw new Error("Creator Studio video provider is not configured");
  return { env, key };
}

async function providerFetch(path: string, init: RequestInit = {}) {
  const { env, key } = credentials();
  const response = await fetch(`https://api.shotstack.io/edit/${env}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": key,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Creator Studio provider request failed (${response.status})`);
  }
  return response;
}

export async function submitShotstackRender(edit: unknown) {
  const response = await providerFetch("/render", {
    method: "POST",
    body: JSON.stringify(edit),
  });
  return SubmitResponseSchema.parse(await response.json()).response;
}

export async function getShotstackRender(renderId: string) {
  z.string().uuid().parse(renderId);
  const response = await providerFetch(`/render/${encodeURIComponent(renderId)}`);
  return StatusResponseSchema.parse(await response.json()).response;
}

/**
 * Shotstack render callbacks are not currently signed. Treat callback payloads
 * as untrusted hints only. Before changing local job state, query the provider
 * by render id with getShotstackRender() and persist that authoritative result.
 */
export function parseUntrustedShotstackCallback(input: unknown) {
  return z.object({
    type: z.string(),
    action: z.string(),
    id: z.string().uuid(),
    status: z.string(),
  }).parse(input);
}

export function shotstackEnvironmentForDiagnostics() {
  return environment();
}
