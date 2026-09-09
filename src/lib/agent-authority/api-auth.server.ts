import { hashApiKey } from "./api-keys.server";
import { AuthorityApiError } from "./api-errors";

export type AuthorityApiScope =
  | "passports:read"
  | "decisions:write"
  | "approvals:read"
  | "receipts:read"
  | "evidence:write"
  | "webhooks:manage";

export interface AuthorityApiIdentity {
  id: string;
  workspaceId: string;
  createdBy: string;
  scopes: AuthorityApiScope[];
  rateLimitPerMinute: number;
  rateLimitRemaining: number;
  rateLimitResetAt: string;
}

export async function authenticateAuthorityApiKey(request: Request, requiredScope: AuthorityApiScope): Promise<AuthorityApiIdentity> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
  const token = match?.[1] ?? "";
  if (!token) throw new AuthorityApiError(401, "AUTH_MISSING", "Bearer API key is required");
  // Bound untrusted credential input before hashing/database work.
  if (token.length < 32 || token.length > 200 || !/^avap_live_[A-Za-z0-9_-]+$/.test(token)) {
    throw new AuthorityApiError(401, "AUTH_INVALID", "Invalid API credential");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as any;
  const keyHash = hashApiKey(token);
  const { data: key, error } = await client
    .from("agent_authority_api_keys")
    .select("id,workspace_id,created_by,scopes,expires_at,revoked_at,rate_limit_per_minute")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error || !key) throw new AuthorityApiError(401, "AUTH_INVALID", "Invalid API credential");
  if (key.revoked_at) throw new AuthorityApiError(401, "KEY_REVOKED", "API key has been revoked");
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    throw new AuthorityApiError(401, "KEY_EXPIRED", "API key has expired");
  }
  if (!(key.scopes as string[]).includes(requiredScope)) {
    throw new AuthorityApiError(403, "INSUFFICIENT_SCOPE", `API key lacks required scope: ${requiredScope}`);
  }

  const limit = Math.max(1, Math.min(Number(key.rate_limit_per_minute ?? 60), 10_000));
  const { data: consumed, error: rateError } = await client.rpc("consume_agent_authority_rate_limit", {
    p_api_key_id: key.id,
    p_limit: limit,
  });
  if (rateError || !consumed) {
    throw new AuthorityApiError(500, "INTERNAL_ERROR", "API rate-limit state could not be evaluated");
  }
  const rate = Array.isArray(consumed) ? consumed[0] : consumed;
  if (!rate?.allowed) {
    throw new AuthorityApiError(429, "RATE_LIMITED", "API rate limit exceeded", {
      limit,
      remaining: 0,
      resetAt: rate?.reset_at,
    });
  }

  // Never persist or log the plaintext credential. Successful admission is observable.
  const { error: usageError } = await client
    .from("agent_authority_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .is("revoked_at", null);
  if (usageError) {
    throw new AuthorityApiError(500, "INTERNAL_ERROR", "API key usage state could not be recorded");
  }

  return {
    id: key.id,
    workspaceId: key.workspace_id,
    createdBy: key.created_by,
    scopes: key.scopes as AuthorityApiScope[],
    rateLimitPerMinute: limit,
    rateLimitRemaining: Number(rate.remaining ?? 0),
    rateLimitResetAt: rate.reset_at,
  };
}
