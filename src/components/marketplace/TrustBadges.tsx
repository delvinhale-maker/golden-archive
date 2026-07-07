import { ShieldCheck, Download, RefreshCw, Lock } from "lucide-react";

export function TrustBadges() {
  const items = [
    { icon: Download, label: "Instant Delivery", sub: "Email link in seconds" },
    { icon: ShieldCheck, label: "Buyer Protection", sub: "Verified creators" },
    { icon: RefreshCw, label: "7-Day Guarantee", sub: "Full refund window" },
    { icon: Lock, label: "Secure Checkout", sub: "Encrypted by Stripe" },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map(({ icon: Icon, label, sub }) => (
        <div key={label} className="flex items-start gap-2 rounded-lg border border-line bg-white p-3">
          <Icon size={16} className="mt-0.5 text-gold-ink" />
          <div>
            <div className="text-[12px] font-bold text-ink">{label}</div>
            <div className="text-[11px] text-mute">{sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function KingdomGuarantee() {
  return (
    <div className="mt-5 rounded-xl border-2 border-gold/40 bg-gradient-to-br from-[#fdf9ec] to-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-ink">
          <ShieldCheck size={20} />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-caps text-gold-ink">
            The AurumVault Guarantee
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">
            Purpose-driven. Quality-verified.
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-mute">
            Every resource is reviewed by our team and backed by a 7-day,
            no-questions-asked refund window. If it doesn't move you forward,
            we'll make it right.
          </p>
        </div>
      </div>
    </div>
  );
}

export function FormatSelector({
  formats, value, onChange,
}: {
  formats: { id: string; label: string; sub?: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-caps text-mute">
        Format
      </div>
      <div className="grid grid-cols-3 gap-2">
        {formats.map((f) => {
          const active = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id)}
              className={`rounded-lg border-2 px-3 py-2.5 text-left transition ${
                active
                  ? "border-gold bg-[var(--accent)]"
                  : "border-line bg-white hover:border-gold/60"
              }`}
            >
              <div className="text-[13px] font-bold text-ink">{f.label}</div>
              {f.sub && <div className="text-[11px] text-mute">{f.sub}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
