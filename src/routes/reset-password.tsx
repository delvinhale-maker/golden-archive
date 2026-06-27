import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AVLogo } from "@/components/marketplace/AVLogo";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password | AurumVault" },
      { name: "description", content: "Set a new password for your AurumVault account." },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://www.aurumvault.store/reset-password" }],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasSession(true);
        setReady(true);
      }
    });
    // Also check immediately in case the event fired before mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const rules = [
    { id: "len", label: "At least 8 characters", ok: password.length >= 8 },
    { id: "upper", label: "One uppercase letter (A–Z)", ok: /[A-Z]/.test(password) },
    { id: "lower", label: "One lowercase letter (a–z)", ok: /[a-z]/.test(password) },
    { id: "num", label: "One number (0–9)", ok: /[0-9]/.test(password) },
    { id: "sym", label: "One symbol (!@#$…)", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const passedCount = rules.filter((r) => r.ok).length;
  const allPassed = passedCount === rules.length;
  const matches = confirm.length > 0 && password === confirm;
  const canSubmit = allPassed && matches && !busy;
  const strengthLabel =
    passedCount <= 2 ? "Weak" : passedCount === 3 ? "Fair" : passedCount === 4 ? "Strong" : "Excellent";
  const strengthColor =
    passedCount <= 2 ? "bg-red-500" : passedCount === 3 ? "bg-amber-500" : passedCount === 4 ? "bg-emerald-500" : "bg-emerald-600";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!allPassed) {
      toast.error("Password doesn't meet all requirements yet.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

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
          <h1 className="font-display text-3xl md:text-4xl text-navy">Reset password</h1>
          <p className="mt-1 text-sm text-mute">
            Choose a new password for your AurumVault account.
          </p>

          {!ready ? (
            <p className="mt-6 text-sm text-mute">Verifying your reset link…</p>
          ) : !hasSession ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-ink/80">
                This reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-navy text-white font-semibold text-sm hover:bg-navy/90"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3" noValidate>
              <Field label="New password">
                <input
                  type="password" required minLength={8} autoFocus
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="auth-input" placeholder="At least 8 characters"
                  aria-describedby="pw-rules"
                />
              </Field>

              {password.length > 0 && (
                <div id="pw-rules" className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/60">
                      Password strength
                    </span>
                    <span className="text-[11px] font-semibold text-ink/80">{strengthLabel}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={`h-full ${strengthColor} transition-all`}
                      style={{ width: `${(passedCount / rules.length) * 100}%` }}
                    />
                  </div>
                  <ul className="mt-3 space-y-1">
                    {rules.map((r) => (
                      <li
                        key={r.id}
                        className={`text-[12px] flex items-center gap-2 ${r.ok ? "text-emerald-700" : "text-ink/60"}`}
                      >
                        <span aria-hidden>{r.ok ? "✓" : "○"}</span>
                        <span>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Field label="Confirm new password">
                <input
                  type="password" required minLength={8}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="auth-input" placeholder="Re-enter password"
                  aria-invalid={confirm.length > 0 && !matches}
                />
              </Field>
              {confirm.length > 0 && !matches && (
                <p role="alert" className="text-[12px] text-red-600">Passwords don't match.</p>
              )}

              <button
                type="submit" disabled={!canSubmit}
                className="mt-2 w-full h-11 rounded-full bg-navy text-white font-semibold text-sm hover:bg-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
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
