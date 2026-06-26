import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AVLogo } from "@/components/marketplace/AVLogo";

type Status = "loading" | "ready" | "submitting" | "done" | "used" | "invalid";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  component: UnsubscribePage,
  head: () => ({ meta: [{ title: "Unsubscribe — AurumVault" }] }),
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.valid) {
          setStatus(body?.reason === "already_used" ? "used" : "invalid");
          return;
        }
        setEmail(body.email || "");
        setStatus("ready");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [token]);

  async function confirm() {
    setStatus("submitting");
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setStatus(res.ok ? "done" : "invalid");
    } catch {
      setStatus("invalid");
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4">
          <Link to="/"><AVLogo /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 md:px-8 py-16">
        <div className="bg-white border border-ink/10 rounded-2xl p-8 text-center">
          {status === "loading" && <p className="text-mute">Checking your link…</p>}
          {status === "ready" && (
            <>
              <h1 className="font-display text-2xl text-navy">Unsubscribe</h1>
              <p className="text-mute mt-2">
                We'll stop sending AurumVault emails to <strong>{email || "this address"}</strong>.
              </p>
              <button onClick={confirm} className="mt-6 inline-flex rounded-full bg-navy text-white px-5 py-2.5 font-semibold hover:bg-navy/90">
                Confirm unsubscribe
              </button>
            </>
          )}
          {status === "submitting" && <p className="text-mute">Updating preferences…</p>}
          {status === "done" && (
            <>
              <h1 className="font-display text-2xl text-navy">You're unsubscribed</h1>
              <p className="text-mute mt-2">You won't receive further emails from AurumVault.</p>
              <Link to="/" className="mt-6 inline-flex rounded-full bg-navy text-white px-5 py-2.5 font-semibold">Back to AurumVault</Link>
            </>
          )}
          {status === "used" && (
            <>
              <h1 className="font-display text-2xl text-navy">Already unsubscribed</h1>
              <p className="text-mute mt-2">This address is already opted out.</p>
            </>
          )}
          {status === "invalid" && (
            <>
              <h1 className="font-display text-2xl text-navy">Invalid link</h1>
              <p className="text-mute mt-2">This unsubscribe link is invalid or expired.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
