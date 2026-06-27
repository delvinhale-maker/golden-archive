import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { MarketShell } from "@/components/marketplace/MarketShell";

export function RouteErrorFallback({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: unknown;
  reset?: () => void;
  title?: string;
}) {
  const router = useRouter();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "We couldn't load this page. Please try again.";
  return (
    <MarketShell>
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <AlertTriangle size={36} className="mx-auto text-gold" />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-mute break-words">{message}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              try {
                reset?.();
              } catch {
                /* ignore */
              }
              router.invalidate();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gold py-3 text-sm font-bold text-navy"
          >
            <RotateCcw size={14} /> Try again
          </button>
          <Link
            to="/"
            className="rounded-full border border-navy py-3 text-sm font-bold text-navy"
          >
            Back to home
          </Link>
        </div>
      </div>
    </MarketShell>
  );
}
