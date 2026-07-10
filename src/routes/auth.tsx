import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AVLogo } from "@/components/marketplace/AVLogo";
import { toast } from "sonner";
import {
  beginOAuthAttempt,
  clearOAuthCorrelationId,
  logOAuthEvent,
  logOAuthFailure,
  sessionMarker,
} from "@/lib/oauth-telemetry";
import { resolvePostAuthRedirect } from "@/lib/post-auth-redirect";
import {
  runGoogleSignInDiagnostics,
  diagnosticsShortLine,
  type DiagnosticsResult,
} from "@/lib/oauth-diagnostics";


async function fetchRolesFor(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    return (data ?? []).map((r: { role: string }) => r.role);
  } catch {
    return [];
  }
}

async function resolveRedirectForSession(savedRedirect?: string | null): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  const roles = uid ? await fetchRolesFor(uid) : [];
  return resolvePostAuthRedirect({ roles, savedRedirect });
}

const authSearchSchema = z.object({
  redirect: z.string().optional(),
  message: z.string().max(200).optional(),
});

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: authSearchSchema,
  head: () => ({
    meta: [
      { title: "Sign in | AurumVault" },
      { name: "description", content: "Sign in, create your AurumVault account, or reset your password." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Sign in | AurumVault" },
      { property: "og:description", content: "Sign in or create your AurumVault account." },
      { property: "og:url", content: "https://www.aurumvault.store/auth" },
      { name: "twitter:title", content: "Sign in | AurumVault" },
      { name: "twitter:description", content: "Sign in or create your AurumVault account." },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/auth" }],
  }),
});

type AuthMode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { redirect, message } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const explicitRedirect = redirect ?? null;


  useEffect(() => {
    let cancelled = false;
    const go = async (saved?: string | null) => {
      const to = await resolveRedirectForSession(saved ?? explicitRedirect);
      if (!cancelled) navigate({ to });
    };
    // Initial check
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void tryAttachReferral();
        void go(explicitRedirect);
      }
    });
    // Listen for sign-in completing via OAuth popup / cross-tab broker.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        void tryAttachReferral();
        const saved = sessionStorage.getItem("av_oauth_redirect");
        sessionStorage.removeItem("av_oauth_redirect");
        void go(saved ?? explicitRedirect);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, explicitRedirect]);

  async function tryAttachReferral() {
    try {
      const { getStoredRef, getStoredRefSource, clearStoredRef } = await import("@/lib/referral");
      const code = getStoredRef();
      if (!code) return;
      const { attachReferral } = await import("@/lib/referrals.functions");
      const res = await attachReferral({ data: { code, source: getStoredRefSource() ?? undefined } });
      if (res?.ok) clearStoredRef();
    } catch {
      /* non-fatal */
    }
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        // Supabase returns a user with empty identities[] when the email is already registered.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          toast.error("An account with this email already exists. Please sign in instead.");
          setMode("signin");
          setPassword("");
          return;
        }
        if (!data.session) {
          toast.success("Check your email to confirm your account before signing in.");
          setMode("signin");
          return;
        }
        toast.success("Account created — welcome to AurumVault");
        await tryAttachReferral();
        navigate({ to: await resolveRedirectForSession(explicitRedirect) });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/invalid login credentials/i.test(error.message)) {
            toast.error("Incorrect email or password. Try again or reset your password.");
          } else {
            toast.error(error.message);
          }
          return;
        }
        if (!data.session) {
          toast.error("Sign-in did not complete. Please try again.");
          return;
        }
        toast.success("Welcome back");
        await tryAttachReferral();
        navigate({ to: await resolveRedirectForSession(explicitRedirect) });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your email address to receive a reset link.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setDiagnostics(null);
    setShowDiagnostics(false);
    const correlationId = beginOAuthAttempt("google");
    if (redirect) {
      sessionStorage.setItem("av_oauth_redirect", redirect);
    }
    const finish = () => {
      sessionStorage.removeItem("av_oauth_redirect");
      clearOAuthCorrelationId();
      setBusy(false);
    };

    const showFailure = (opts: {
      reason: Parameters<typeof logOAuthFailure>[0]["reason"];
      title: string;
      description: string;
      rawMessage?: unknown;
      runDiag?: boolean;
    }) => {
      logOAuthFailure({ provider: "google", reason: opts.reason, rawMessage: opts.rawMessage });
      const diag = opts.runDiag !== false ? runGoogleSignInDiagnostics() : null;
      if (diag) {
        setDiagnostics(diag);
        setShowDiagnostics(true);
      }
      toast.error(opts.title, {
        description:
          opts.description +
          (diag ? ` — ${diagnosticsShortLine(diag)}` : "") +
          ` (ref ${correlationId.slice(0, 8)})`,
        duration: 10000,
        action: diag
          ? {
              label: "Show details",
              onClick: () => setShowDiagnostics(true),
            }
          : undefined,
      });
    };

    // Pre-flight: catch obvious local blockers before hitting Google.
    const preflight = runGoogleSignInDiagnostics();
    const hardFail = preflight.checks.find((c) => c.status === "fail");
    if (hardFail) {
      if (hardFail.id === "cookies") {
        showFailure({
          reason: "cookiesBlocked",
          title: "Cookies are blocked",
          description:
            hardFail.detail ??
            "Enable cookies for aurumvault.store, then try Continue with Google again.",
          runDiag: false,
        });
        setDiagnostics(preflight);
        setShowDiagnostics(true);
      } else if (hardFail.id === "localStorage" || hardFail.id === "sessionStorage") {
        showFailure({
          reason: "storageBlocked",
          title: "Browser storage is blocked",
          description:
            hardFail.detail ??
            "Private/Incognito mode may block sign-in. Try a normal window.",
          runDiag: false,
        });
        setDiagnostics(preflight);
        setShowDiagnostics(true);
      } else if (hardFail.id === "popup") {
        showFailure({
          reason: "popupBlocked",
          title: "Popups are blocked",
          description:
            hardFail.detail ??
            "Allow popups for aurumvault.store, then try Continue with Google again.",
          runDiag: false,
        });
        setDiagnostics(preflight);
        setShowDiagnostics(true);
      } else if (hardFail.id === "online") {
        showFailure({
          reason: "network",
          title: "You appear to be offline",
          description: "Check your connection and try again.",
          runDiag: false,
        });
        setDiagnostics(preflight);
        setShowDiagnostics(true);
      }
      finish();
      return;
    }

    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res.error) {
        const raw =
          (res.error as { message?: string } | null)?.message?.toLowerCase() ?? "";
        if (
          raw.includes("popup") ||
          raw.includes("blocked") ||
          raw.includes("window") ||
          raw.includes("closed")
        ) {
          showFailure({
            reason: "popupBlocked",
            title: "Popup blocked or closed",
            description:
              "Allow popups for aurumvault.store, then tap Continue with Google. On iOS Safari, also disable Cross-Site Tracking Prevention.",
            rawMessage: raw,
          });
        } else if (raw.includes("cookie") || raw.includes("storage")) {
          showFailure({
            reason: "cookiesBlocked",
            title: "Cookies or storage blocked",
            description:
              "Google couldn't set the cookies needed to complete sign-in. Enable cookies for this site (and disable strict tracking prevention), then retry.",
            rawMessage: raw,
          });
        } else if (
          raw.includes("redirect") ||
          raw.includes("redirect_uri") ||
          raw.includes("origin")
        ) {
          showFailure({
            reason: "redirectMismatch",
            title: "Redirect URL not accepted",
            description:
              "Google rejected the redirect URL for this site. This is a configuration issue — copy the ref below and contact support.",
            rawMessage: raw,
          });
        } else if (raw.includes("network") || raw.includes("fetch") || raw.includes("timeout")) {
          showFailure({
            reason: "network",
            title: "Network error reaching Google",
            description: "Check your connection or try again in a moment.",
            rawMessage: raw,
          });
        } else if (
          raw.includes("cancel") ||
          raw.includes("denied") ||
          raw.includes("access_denied")
        ) {
          logOAuthFailure({ provider: "google", reason: "cancelled", rawMessage: raw });
          toast.error("Sign-in cancelled", {
            description:
              "You closed the Google window before finishing. Tap Continue with Google to retry.",
          });
        } else {
          showFailure({
            reason: "unknown",
            title: "Google sign-in failed",
            description:
              (res.error as { message?: string } | null)?.message ||
              "Please try again, or use email and password below.",
            rawMessage: raw,
          });
        }
        finish();
        return;
      }
      if (!res.redirected) {
        // Confirm a session actually landed before navigating.
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          showFailure({
            reason: "noSession",
            title: "Google sign-in didn't complete",
            description:
              "Google returned success but we didn't receive a session — usually a cookie or third-party-cookie block. See details below.",
          });
          finish();
          return;
        }
        logOAuthEvent({
          level: "info",
          provider: "google",
          correlationId,
          event: "oauth.success",
          meta: { session: sessionMarker(sess.session.access_token) },
        });
        const saved = sessionStorage.getItem("av_oauth_redirect");
        sessionStorage.removeItem("av_oauth_redirect");
        clearOAuthCorrelationId();
        navigate({ to: await resolveRedirectForSession(saved) });
      } else {
        logOAuthEvent({
          level: "info",
          provider: "google",
          correlationId,
          event: "oauth.redirected",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("popup") || msg.includes("blocked") || msg.includes("window")) {
        showFailure({
          reason: "popupBlocked",
          title: "Popup blocked",
          description:
            "Your browser blocked the Google popup. Allow popups for this site and try again.",
          rawMessage: msg,
        });
      } else if (msg.includes("cookie") || msg.includes("storage")) {
        showFailure({
          reason: "cookiesBlocked",
          title: "Cookies or storage blocked",
          description:
            "Sign-in couldn't complete because cookies/storage are restricted. See details below.",
          rawMessage: msg,
        });
      } else if (msg.includes("redirect") || msg.includes("origin")) {
        showFailure({
          reason: "redirectMismatch",
          title: "Redirect URL issue",
          description:
            "Google rejected the redirect URL for this site. This is a configuration issue — contact support with the ref below.",
          rawMessage: msg,
        });
      } else if (msg.includes("network") || msg.includes("fetch")) {
        showFailure({
          reason: "network",
          title: "Network error",
          description: "Check your connection and try again.",
          rawMessage: msg,
        });
      } else {
        showFailure({
          reason: "unknown",
          title: "Couldn't reach Google",
          description:
            err instanceof Error ? err.message : "Unexpected error. Please try again.",
          rawMessage: msg,
        });
      }
      finish();
    }
  }


  const tabs: { key: AuthMode; label: string }[] = [
    { key: "signin", label: "Sign in" },
    { key: "signup", label: "Sign up" },
    { key: "forgot", label: "Forgot password" },
  ];

  return (
    <div className="min-h-screen bg-[#0F1A33] text-white flex flex-col">
      <div className="px-4 py-5 md:px-8">
        <Link to="/"><AVLogo /></Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl bg-white text-ink p-7 md:p-9 shadow-2xl"
        >
          <h1 className="font-display text-3xl md:text-4xl text-navy">
            {mode === "signin" && "Welcome back"}
            {mode === "signup" && "Join AurumVault"}
            {mode === "forgot" && "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-mute">
            {mode === "signin" && "Sign in to access your library and seller tools."}
            {mode === "signup" && "Create your account to buy, sell, and curate Kingdom resources."}
            {mode === "forgot" && "Enter your email and we'll send you a reset link."}
          </p>

          {message && (
            <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-medium text-navy">
              {message}
            </div>
          )}

          <div className="mt-6 flex border-b border-ink/10">
            {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setMode(tab.key);
                if (tab.key !== "forgot") setResetSent(false);
              }}
              aria-pressed={mode === tab.key}
              className={`flex-1 pb-2.5 text-sm font-medium transition-colors ${
                mode === tab.key
                  ? "border-b-2 border-navy text-navy"
                  : "text-mute hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
            ))}
          </div>

          {mode !== "forgot" && (
            <>
              <button
                type="button"
                onClick={google}
                disabled={busy}
                className="mt-6 w-full h-11 rounded-full border border-ink/15 bg-white text-sm font-medium hover:bg-ink/5 flex items-center justify-center gap-2"
              >
                <GoogleGlyph /> Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-mute">
                <div className="flex-1 h-px bg-ink/10" /> or <div className="flex-1 h-px bg-ink/10" />
              </div>
            </>
          )}

          {mode === "forgot" ? (
            resetSent ? (
              <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-5 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-navy">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <h2 className="font-display text-lg text-navy">Check your inbox</h2>
                <p className="mt-1 text-sm text-ink/80">
                  If an account exists for <span className="font-semibold text-navy">{email}</span>, we sent a password reset link.
                </p>
                <button
                  type="button"
                  onClick={() => setResetSent(false)}
                  className="mt-4 text-sm font-medium text-navy underline-offset-2 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={submitReset} className="mt-6 space-y-3">
                <Field label="Email">
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="auth-input" placeholder="you@example.com"
                  />
                </Field>
                <button
                  type="submit" disabled={busy}
                  className="mt-2 w-full h-11 rounded-full bg-navy text-white font-semibold text-sm hover:bg-navy/90 disabled:opacity-60"
                >
                  {busy ? "Please wait…" : "Send reset link"}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={submitAuth} className="space-y-3">
              {mode === "signup" && (
                <Field label="Full name">
                  <input
                    required value={name} onChange={(e) => setName(e.target.value)}
                    className="auth-input" placeholder="Your name"
                  />
                </Field>
              )}
              <Field label="Email">
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="auth-input" placeholder="you@example.com"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password" required minLength={6}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="auth-input" placeholder="At least 6 characters"
                />
              </Field>
              <button
                type="submit" disabled={busy}
                className="mt-2 w-full h-11 rounded-full bg-navy text-white font-semibold text-sm hover:bg-navy/90 disabled:opacity-60"
              >
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-mute">
            {mode === "forgot" ? (
              <>
                Remember your password?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="font-medium text-navy underline-offset-2 hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                {mode === "signin" ? "New to AurumVault?" : "Already have an account?"}{" "}
                <button
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="font-medium text-navy underline-offset-2 hover:underline"
                >
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </>
            )}
          </p>
        </motion.div>
      </div>
      <style>{`.auth-input{display:block;width:100%;height:44px;border-radius:12px;border:1px solid rgb(0 0 0 / 0.1);padding:0 14px;font-size:14px;background:white;color:#0F1A33}.auth-input:focus{outline:none;border-color:#C9A24B;box-shadow:0 0 0 3px rgb(201 162 75 / 0.15)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-ink/70 mb-1">{label}</span>
      {children}
    </label>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.4 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}
