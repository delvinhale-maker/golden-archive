import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { PublisherShell, ACCENTS } from "@/components/marketplace/PublisherShell";
import { getMyEntitlementsFn } from "@/lib/creator-studio/entitlements.functions";
import {
  StripeEmbeddedCreatorStudioSubscriptionCheckout,
  StripeEmbeddedCreatorStudioExtraCreditCheckout,
} from "@/components/StripeEmbeddedCheckout";

export const Route = createFileRoute("/_authenticated/creator-studio/upgrade")({
  component: UpgradePage,
});

type Selection = { kind: "PRO" } | { kind: "BUSINESS" } | { kind: "EXTRA_CREDIT" } | null;

/** Plan/credit upgrade -- fully gated by CREATOR_STUDIO_PAID_PLANS_ENABLED server-side (createSubscriptionCheckoutFn / createExtraCreditCheckoutFn both re-check it). */
function UpgradePage() {
  const [selection, setSelection] = useState<Selection>(null);
  const entitlementsFn = useServerFn(getMyEntitlementsFn);
  const { data: entitlements } = useQuery({
    queryKey: ["creator-studio", "entitlements"],
    queryFn: () => entitlementsFn(),
    retry: false,
  });

  return (
    <PublisherShell accent={ACCENTS.creatorStudio}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-center font-display text-3xl text-navy">Upgrade your plan</h1>
        {entitlements && (
          <p className="mt-2 text-center text-sm text-mute">
            You're currently on the{" "}
            {entitlements.plan === "FREE"
              ? "Free"
              : entitlements.plan === "CREATOR_PRO"
                ? "Creator Pro"
                : "Creator Business"}{" "}
            plan.
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <PlanCard
            title="Creator Pro"
            price="$19/mo"
            bullets={["10 videos per month", "All styles & durations", "Priority queue"]}
            onSelect={() => setSelection({ kind: "PRO" })}
            active={selection?.kind === "PRO"}
          />
          <PlanCard
            title="Creator Business"
            price="$49/mo"
            bullets={["50 videos per month", "All styles & durations", "Priority queue"]}
            onSelect={() => setSelection({ kind: "BUSINESS" })}
            active={selection?.kind === "BUSINESS"}
          />
          <PlanCard
            title="Extra Video"
            price="A few dollars"
            bullets={["One additional video", "Never expires", "Use any time"]}
            onSelect={() => setSelection({ kind: "EXTRA_CREDIT" })}
            active={selection?.kind === "EXTRA_CREDIT"}
          />
        </div>

        {selection && (
          <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-5">
            {selection.kind === "PRO" && (
              <StripeEmbeddedCreatorStudioSubscriptionCheckout plan="CREATOR_PRO" />
            )}
            {selection.kind === "BUSINESS" && (
              <StripeEmbeddedCreatorStudioSubscriptionCheckout plan="CREATOR_BUSINESS" />
            )}
            {selection.kind === "EXTRA_CREDIT" && (
              <StripeEmbeddedCreatorStudioExtraCreditCheckout />
            )}
          </div>
        )}
      </div>
    </PublisherShell>
  );
}

function PlanCard({
  title,
  price,
  bullets,
  onSelect,
  active,
}: {
  title: string;
  price: string;
  bullets: string[];
  onSelect: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-5 text-left transition ${
        active
          ? "border-[#7A2E52] bg-[#7A2E52]/5"
          : "border-ink/10 bg-white hover:border-[#7A2E52]/40"
      }`}
    >
      <h3 className="font-display text-lg text-navy">{title}</h3>
      <p className="mt-1 text-2xl font-bold text-navy">{price}</p>
      <ul className="mt-3 space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-center gap-2 text-sm text-mute">
            <Check size={14} className="text-[#7A2E52]" aria-hidden="true" /> {b}
          </li>
        ))}
      </ul>
    </button>
  );
}
