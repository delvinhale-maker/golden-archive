import { getCreatorStudioProvider } from "@/lib/creator-studio.shotstack.server";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function handleCreatorStudioProviderCallback(
  renderJobId: string,
  callbackToken: string,
): Promise<{ status: 200 | 202 | 401 | 404 }> {
  const admin = await adminClient();
  const { data: row } = await admin
    .from("creator_studio_render_jobs")
    .select("id,status,provider_job_id")
    .eq("id", renderJobId)
    .maybeSingle();
  if (!row) return { status: 404 };

  const { data: state } = await admin
    .from("creator_studio_provider_state")
    .select("callback_secret_hash")
    .eq("render_job_id", renderJobId)
    .maybeSingle();
  if (!state?.callback_secret_hash) return { status: 404 };

  const presentedHash = await sha256Hex(callbackToken);
  if (!constantTimeEqual(presentedHash, String(state.callback_secret_hash))) {
    return { status: 401 };
  }

  if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(String(row.status))) {
    return { status: 200 };
  }
  if (!row.provider_job_id) return { status: 202 };

  let verified;
  try {
    verified = await getCreatorStudioProvider().getRenderStatus(String(row.provider_job_id));
  } catch (error) {
    console.error("[creator-studio] verified callback status lookup failed", {
      renderJobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 202 };
  }

  if (verified.state === "FAILED") {
    await admin.rpc("creator_studio_server_apply_provider_status", {
      _render_job_id: renderJobId,
      _job_status: "FAILED",
      _provider_status: verified.providerStatus,
      _error_code: verified.safeErrorCode,
      _safe_error_message: verified.safeErrorMessage,
      _provider_metadata: verified.metadata,
    });
    return { status: 200 };
  }

  if (verified.state === "RENDERING") {
    await admin.rpc("creator_studio_server_apply_provider_status", {
      _render_job_id: renderJobId,
      _job_status: "RENDERING",
      _provider_status: verified.providerStatus,
      _provider_metadata: verified.metadata,
    });
    return { status: 200 };
  }

  if (verified.state === "SUCCEEDED") {
    // Keep the public job non-terminal until AurumVault has copied the provider
    // output into its own private storage. The watchdog or authenticated poll
    // performs that potentially longer-running ingestion step.
    await admin
      .from("creator_studio_provider_state")
      .update({
        provider_status: verified.providerStatus,
        provider_output_url: verified.outputUrl,
        provider_metadata: verified.metadata,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("render_job_id", renderJobId);
    return { status: 200 };
  }

  await admin
    .from("creator_studio_provider_state")
    .update({
      provider_status: verified.providerStatus,
      provider_metadata: verified.metadata,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("render_job_id", renderJobId);
  return { status: 200 };
}
