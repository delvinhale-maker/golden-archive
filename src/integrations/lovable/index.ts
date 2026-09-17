// Transitional compatibility wrapper for existing call sites.
// Despite the legacy module path/export name, OAuth is now handled directly by
// Supabase Auth and no longer depends on @lovable.dev/cloud-auth-js.

import type { Provider } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

type LegacyProvider = "google" | "apple" | "microsoft" | "lovable";

function toSupabaseProvider(provider: LegacyProvider): Provider | null {
  if (provider === "microsoft") return "azure";
  if (provider === "google" || provider === "apple") return provider;
  return null;
}

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: LegacyProvider, opts?: SignInOptions) => {
      const supabaseProvider = toSupabaseProvider(provider);
      if (!supabaseProvider) {
        return {
          redirected: false,
          error: new Error(
            `OAuth provider "${provider}" is not available after the Lovable exit. Use a directly configured Supabase Auth provider.`,
          ),
        };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider,
        options: {
          redirectTo: opts?.redirect_uri,
          queryParams: opts?.extraParams,
        },
      });

      if (error) {
        return { redirected: false, error };
      }

      return {
        redirected: Boolean(data?.url),
        url: data?.url ?? null,
        provider: data?.provider ?? supabaseProvider,
        error: null,
      };
    },
  },
};
