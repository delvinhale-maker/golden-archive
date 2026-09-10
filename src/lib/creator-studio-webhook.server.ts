import { refreshCreatorStudioRenderByProviderId } from "@/lib/creator-studio-render-service.server";

export async function handleCreatorStudioShotstackWebhook(input: { token: string | null; providerRenderId: string | null }) {
  const expected = process.env.CREATOR_STUDIO_WEBHOOK_TOKEN;
  if (!expected || !input.token || input.token !== expected) {
    return { status: 401 as const, body: { ok: false } };
  }
  if (!input.providerRenderId) {
    return { status: 400 as const, body: { ok: false } };
  }

  // Shotstack callback payload fields are intentionally not trusted for state.
  // We use only the render identifier, then re-query Shotstack server-side.
  const refreshed = await refreshCreatorStudioRenderByProviderId(input.providerRenderId);
  if (!refreshed) return { status: 404 as const, body: { ok: false } };
  return { status: 200 as const, body: { ok: true, jobId: refreshed.id, status: refreshed.status } };
}
