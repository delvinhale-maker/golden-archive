import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AVLogo } from "@/components/marketplace/AVLogo";

type Status = "loading" | "confirmed" | "already" | "invalid";

export const Route = createFileRoute("/subscribe/confirm")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: ConfirmPage,
  head: () => ({ meta: [{ title: "Confirm subscription — AurumVault" }] }),
});

function ConfirmPage() {
  const { token } = useSearch({ from: "/subscribe/confirm" });
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      const { data, error } = await (supabase.rpc as any)("confirm_subscriber", { _token: token });
      if (error || !data || (data as any).ok === false) {
        setStatus("invalid");
        return;
      }
      const payload = data as { ok: boolean; already?: boolean; email?: string };
      if (payload.email) setEmail(payload.email);
      setStatus(payload.already ? "already" : "confirmed");
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4">
          <Link to="/"><AVLogo /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 md:px-8 py-16">
        <div className="bg-white border border-ink/10 rounded-2xl p-8 text-center">
          {status === "loading" && <p className="text-mute">Confirming your subscription…</p>}
          {status === "confirmed" && (
            <>
              <h1 className="font-display text-2xl text-navy">You're confirmed</h1>
              <p className="text-mute mt-2">
                {email ? <>Welcome aboard, <strong>{email}</strong>.</> : <>Welcome aboard.</>}{" "}
                Look out for Kingdom resources in your inbox soon.
              </p>
              <Link to="/" className="mt-6 inline-flex rounded-full bg-navy text-white px-5 py-2.5 font-semibold hover:bg-navy/90">
                Continue to AurumVault
              </Link>
            </>
          )}
          {status === "already" && (
            <>
              <h1 className="font-display text-2xl text-navy">Already confirmed</h1>
              <p className="text-mute mt-2">Your subscription is already active.</p>
              <Link to="/" className="mt-6 inline-flex rounded-full bg-navy text-white px-5 py-2.5 font-semibold">Back to AurumVault</Link>
            </>
          )}
          {status === "invalid" && (
            <>
              <h1 className="font-display text-2xl text-navy">Invalid or expired link</h1>
              <p className="text-mute mt-2">This confirmation link isn't valid. Try subscribing again from the homepage.</p>
              <Link to="/" className="mt-6 inline-flex rounded-full bg-navy text-white px-5 py-2.5 font-semibold">Back to AurumVault</Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
