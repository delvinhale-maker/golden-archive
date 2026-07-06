import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { ProductVariant, LicenseType } from "@/lib/product-variants.functions";

const LICENSE_LABEL: Record<LicenseType, string> = {
  personal: "Personal Use",
  commercial: "Commercial License",
  extended: "Extended License",
};

export type SelectedVariant = {
  variant: ProductVariant;
  /** Buyer-chosen price in cents (PWYW), else variant price_cents */
  priceCents: number;
};

export function VariantPicker({
  variants,
  onChange,
}: {
  variants: ProductVariant[];
  onChange: (s: SelectedVariant) => void;
}) {
  const sorted = useMemo(
    () => [...variants].sort((a, b) => a.sort_order - b.sort_order),
    [variants],
  );
  const [selectedId, setSelectedId] = useState<string>(sorted[0]?.id ?? "");
  const selected = sorted.find((v) => v.id === selectedId) ?? sorted[0];

  const [pwyw, setPwyw] = useState<string>(() =>
    selected?.pay_what_you_want
      ? ((selected.min_price_cents ?? 0) / 100).toFixed(2)
      : "",
  );

  useEffect(() => {
    if (!selected) return;
    if (selected.pay_what_you_want) {
      setPwyw(((selected.min_price_cents ?? 0) / 100).toFixed(2));
    }
  }, [selectedId, selected]);

  useEffect(() => {
    if (!selected) return;
    const min = selected.min_price_cents ?? 0;
    const buyer = Math.max(0, Math.round(parseFloat(pwyw || "0") * 100));
    const priceCents = selected.pay_what_you_want
      ? Math.max(min, buyer)
      : selected.price_cents;
    onChange({ variant: selected, priceCents });
  }, [selected, pwyw, onChange]);

  if (!selected) return null;

  return (
    <div className="mt-5 space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-caps text-mute">
        Choose a version
      </div>
      <div className="grid gap-2">
        {sorted.map((v) => {
          const active = v.id === selected.id;
          const priceStr = v.pay_what_you_want
            ? `From $${((v.min_price_cents ?? 0) / 100).toFixed(2)}`
            : `$${(v.price_cents / 100).toFixed(2)}`;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                active
                  ? "border-gold bg-gold/5"
                  : "border-line bg-white hover:border-ink/30"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  active ? "border-gold bg-gold" : "border-line"
                }`}
              >
                {active && <Check size={12} className="text-navy" strokeWidth={3} />}
              </span>
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-bold text-ink">
                    {v.name}
                  </span>
                  <span
                    className="font-display text-base font-bold"
                    style={{ color: "var(--accent-color)" }}
                  >
                    {priceStr}
                  </span>
                </span>
                {v.license_type && (
                  <span className="mt-1 inline-block rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-caps text-mute">
                    {LICENSE_LABEL[v.license_type]}
                  </span>
                )}
                {v.description && (
                  <span className="mt-2 block whitespace-pre-line text-sm text-mute">
                    {v.description}
                  </span>
                )}
                {v.pay_what_you_want && (
                  <span className="mt-1 block text-xs italic text-mute">
                    Name your price — minimum $
                    {((v.min_price_cents ?? 0) / 100).toFixed(2)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selected.pay_what_you_want && (
        <label className="block rounded-xl border border-line bg-white p-4">
          <span className="text-[11px] font-bold uppercase tracking-caps text-mute">
            Your price (min $
            {((selected.min_price_cents ?? 0) / 100).toFixed(2)})
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-bold text-ink">$</span>
            <input
              type="number"
              min={((selected.min_price_cents ?? 0) / 100).toFixed(2)}
              step="0.01"
              value={pwyw}
              onChange={(e) => setPwyw(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-lg font-bold text-ink outline-none focus:border-gold"
            />
          </div>
        </label>
      )}
    </div>
  );
}
