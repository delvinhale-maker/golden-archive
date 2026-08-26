import { useEffect, useId, useRef, useState } from "react";
import { logCtaClick } from "@/lib/cta-tracking";
import {
  INSIDER_CONSENT_TEXT,
  audienceForSource,
  isValidEmail,
  type AudienceType,
  type InsiderSource,
} from "@/lib/insider";

type Variant = "footer" | "hero" | "inline";

interface Props {
  source: InsiderSource;
  /** Overrides the source-inferred segment (e.g. creator or QR surfaces). */
  audienceType?: AudienceType;
  /** Free-form context, e.g. an Academy article slug. */
  topicInterest?: string | null;
  variant?: Variant;
  heading?: string;
  description?: string;
  buttonLabel?: string;
  className?: string;
}

type State = "idle" | "busy" | "done";

export function InsiderSignup({
  source,
  audienceType,
  topicInterest,
  variant = "inline",
  heading,
  description,
  buttonLabel = "Join Free",
  className = "",
}: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const viewLogged = useRef(false);
  const inputId = useId();
  const statusId = useId();

  useEffect(() => {
    if (viewLogged.current) return;
    viewLogged.current = true;
    logCtaClick(`insider_signup_view:${source}`);
  }, [source]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!isValidEmail(clean)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setState("busy");
    try {
      const res = await fetch("/api/public/subscribers/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: clean,
          source,
          audience_type: audienceType ?? audienceForSource(source),
          topic_interest: topicInterest ?? null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(body?.error || "Couldn't subscribe right now. Please try again in a moment.");
        setState("idle");
        return;
      }
      if (body.status === "already_confirmed") {
        setMessage("You're already on the Insider list — thanks!");
      } else if (body.status === "suppressed") {
        setError("This address can't be re-added here. Contact support for help.");
        setState("idle");
        return;
      } else {
        setMessage("Almost there — check your inbox and confirm your subscription.");
      }
      logCtaClick(`insider_subscribed:${source}`);
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setState("idle");
    }
  }

  const onDark = variant !== "inline";

  if (state === "done") {
    return (
      <div className={className}>
        {heading ? <SignupHeading variant={variant} text={heading} /> : null}
        <p
          role="status"
          className={`mt-2 rounded-xl px-4 py-3 text-sm ${
            onDark ? "bg-white/10 text-white" : "bg-navy/5 text-navy"
          }`}
        >
          <span aria-hidden="true">✓ </span>
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {heading ? <SignupHeading variant={variant} text={heading} /> : null}
      {description ? (
        <p className={`mt-2 text-sm ${onDark ? "text-white/70" : "text-mute"}`}>{description}</p>
      ) : null}

      <form
        onSubmit={onSubmit}
        noValidate
        className={`mt-4 flex w-full flex-col gap-2 ${
          variant === "footer" ? "sm:flex-col" : "sm:flex-row sm:gap-3"
        } ${variant === "hero" ? "mx-auto max-w-md" : ""}`}
      >
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <input
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={statusId}
          placeholder="you@example.com"
          className={`min-w-0 flex-1 rounded-full px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-gold ${
            onDark
              ? "border border-white/20 bg-white/10 text-white placeholder-white/50"
              : "border border-ink/15 bg-white text-ink placeholder-mute"
          } ${error ? "border-red-400" : ""}`}
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
        >
          {state === "busy" ? "Joining…" : buttonLabel}
        </button>
      </form>

      <p
        id={statusId}
        role={error ? "alert" : undefined}
        className={`mt-2 text-xs ${
          error ? "font-semibold text-red-500" : onDark ? "text-white/50" : "text-mute"
        }`}
      >
        {error ? (
          <>
            <span aria-hidden="true">⚠ </span>
            {error}
          </>
        ) : (
          <>
            No spam. Unsubscribe anytime.{" "}
            <a
              href="/privacy"
              className={onDark ? "underline hover:text-white" : "underline hover:text-navy"}
            >
              Privacy
            </a>
          </>
        )}
      </p>
      <p className={`mt-1 text-[11px] ${onDark ? "text-white/40" : "text-mute/80"}`}>
        {INSIDER_CONSENT_TEXT}
      </p>
    </div>
  );
}

function SignupHeading({ variant, text }: { variant: Variant; text: string }) {
  if (variant === "footer") {
    return (
      <div className="mb-1 text-[11px] font-semibold tracking-caps text-gold">
        {text.toUpperCase()}
      </div>
    );
  }
  if (variant === "hero") {
    return <h2 className="font-display text-2xl text-white sm:text-3xl">{text}</h2>;
  }
  return <h2 className="font-display text-xl text-navy">{text}</h2>;
}
