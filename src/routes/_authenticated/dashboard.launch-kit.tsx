import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Crown, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getMyFoundingStatus } from "@/lib/founding.functions";
import { FoundingCreatorBadge } from "@/components/marketplace/FoundingCreatorBadge";
import { FOUNDING_EVENTS, formatFoundingNumber } from "@/lib/founding";
import { logCtaClick } from "@/lib/cta-tracking";

export const Route = createFileRoute("/_authenticated/dashboard/launch-kit")({
  component: LaunchKitPage,
  head: () => ({
    meta: [
      { title: "Creator Launch Kit · AurumVault" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const SITE_URL = "https://www.aurumvault.store";

function CopyBlock({ label, value, event }: { label: string; value: string; event?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-caps text-mute">{label}</span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              if (event) logCtaClick(event);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              toast.error("Copy failed — select the text and copy manually.");
            }
          }}
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-ink/15 px-3 text-[12px] font-semibold text-navy"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-ink">{value}</pre>
    </div>
  );
}

function LaunchKitPage() {
  const { user } = useAuth();
  const fetchStatus = useServerFn(getMyFoundingStatus);
  const [storefrontSlug, setStorefrontSlug] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["my-founding-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    logCtaClick(FOUNDING_EVENTS.launchKitViewed);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("seller_applications")
      .select("brand_slug")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle()
      .then(({ data }) => setStorefrontSlug((data?.brand_slug as string | null) ?? null));
  }, [user]);

  const storefrontUrl = storefrontSlug ? `${SITE_URL}/store/${storefrontSlug}` : null;
  const qrSrc = useMemo(
    () =>
      storefrontUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(storefrontUrl)}`
        : null,
    [storefrontUrl],
  );

  const numberLabel = status?.foundingNumber ? formatFoundingNumber(status.foundingNumber) : null;

  const announcement = storefrontUrl
    ? `I'm officially an AurumVault Founding Creator${numberLabel ? ` (${numberLabel})` : ""}.\n\nAurumVault is a curated marketplace for premium digital resources, and my storefront is now live:\n${storefrontUrl}\n\nTake a look — and tell me what you'd like me to build next.`
    : `I'm officially an AurumVault Founding Creator${numberLabel ? ` (${numberLabel})` : ""}.\n\nAurumVault is a curated marketplace for premium digital resources. My storefront goes live as soon as my first product is approved — I'll share the link then.`;

  const shortCaption = `Founding Creator${numberLabel ? ` ${numberLabel}` : ""} on AurumVault. New digital resources, made properly.${storefrontUrl ? `\n${storefrontUrl}` : ""}`;
  const bioLine = `AurumVault Founding Creator${numberLabel ? ` ${numberLabel}` : ""}${storefrontUrl ? ` · ${storefrontUrl}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-mute hover:text-navy">
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <h1 className="mt-4 flex items-center gap-2 font-display text-2xl text-navy">
        <Crown size={20} className="text-gold" /> Creator Launch Kit
      </h1>

      {isLoading ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-mute">
          <Loader2 size={16} className="animate-spin" /> Loading your status…
        </p>
      ) : !status?.isFounding ? (
        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-6">
          <p className="font-semibold text-navy">You're not in the Founding 100 cohort yet</p>
          <p className="mt-2 text-sm text-mute">
            Founding numbers are assigned by the AurumVault team after an application is approved. If
            you haven't applied yet, you can apply for a founding spot — spots are limited to 100
            creators.
          </p>
          <Link
            to="/founding-100"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-navy px-5 font-semibold text-white"
          >
            View the Founding 100
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-2xl border border-gold/30 bg-gradient-to-br from-navy to-[#22335A] p-6 text-white">
            <FoundingCreatorBadge foundingNumber={status.foundingNumber} size="md" />
            <p className="mt-4 font-display text-2xl">
              You're Founding Creator {numberLabel}
            </p>
            <p className="mt-2 text-sm text-white/70">
              Accepted{" "}
              {status.acceptedAt ? new Date(status.acceptedAt).toLocaleDateString() : "recently"}.
              Use the assets below to announce your storefront.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <CopyBlock
              label="Announcement post"
              value={announcement}
              event={FOUNDING_EVENTS.launchKitCopied}
            />
            <CopyBlock
              label="Short social caption"
              value={shortCaption}
              event={FOUNDING_EVENTS.launchKitCopied}
            />
            <CopyBlock label="Bio line" value={bioLine} event={FOUNDING_EVENTS.launchKitCopied} />
            {storefrontUrl ? (
              <CopyBlock
                label="Storefront link"
                value={storefrontUrl}
                event={FOUNDING_EVENTS.launchKitCopied}
              />
            ) : (
              <div className="rounded-xl border border-ink/10 bg-white p-4 text-sm text-mute">
                Your storefront link appears here once your brand storefront is set up by the team.
              </div>
            )}
          </div>

          <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className="flex items-center gap-2 font-semibold text-navy">
              <QrCode size={17} className="text-gold" /> Storefront QR code
            </h2>
            {qrSrc ? (
              <>
                <img
                  src={qrSrc}
                  alt={`QR code linking to ${storefrontUrl}`}
                  width={200}
                  height={200}
                  loading="lazy"
                  className="mt-4 rounded-xl border border-ink/10"
                />
                <p className="mt-3 text-xs text-mute">
                  Right-click or long-press to save. Use it on print materials, packaging or slides.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-mute">
                A QR code is generated once your storefront link is available.
              </p>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-6">
            <h2 className="font-semibold text-navy">Launch checklist</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              {[
                "Complete your creator profile — display name, avatar and bio.",
                "Publish your first product (every product goes through quality review).",
                "Announce your storefront with the post above.",
                "Add your storefront link to your social bios.",
                "Reply to buyer questions on your product pages within 48 hours.",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-gold" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
