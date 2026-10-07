import {
  CATEGORY_FIELD_HELPER,
  DELIVERY_CONTENT_OPTIONS,
  PRODUCT_TYPE_DEFS,
  PRODUCT_TYPE_FIELD_HELPER,
  PRODUCT_DELIVERY_MODELS,
  type ProductDeliveryModel,
  SUBCATEGORY_FIELD_HELPER,
  subcategoryFieldLabel,
  type ProductTypeSlug,
} from "@/lib/taxonomy";
import { useSubcategoryNames } from "@/lib/subcategories";

/**
 * The three taxonomy levels + delivery contents, sourced entirely from
 * src/lib/taxonomy.ts and the admin-managed subcategory rows. No component
 * keeps its own copy of these lists.
 */

function FieldShell({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-navy">{label}</span>
      {helper && <span className="mb-1.5 block text-[12px] text-mute">{helper}</span>}
      {children}
    </label>
  );
}

export function CategoryField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <FieldShell label="Category" helper={CATEGORY_FIELD_HELPER}>
      <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function SubcategoryField({
  categorySlug,
  value,
  onChange,
}: {
  categorySlug: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const options = useSubcategoryNames(categorySlug);
  if (!options.length) return null;
  const all = value && !options.includes(value) ? [value, ...options] : options;
  const label = subcategoryFieldLabel(categorySlug);
  return (
    <FieldShell label={label} helper={SUBCATEGORY_FIELD_HELPER}>
      <select
        className="inp"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Select a {label.toLowerCase()}…</option>
        {all.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function ProductTypeField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: ProductTypeSlug | null) => void;
}) {
  const selected = PRODUCT_TYPE_DEFS.find((t) => t.slug === value);
  return (
    <FieldShell label="Product Type" helper={PRODUCT_TYPE_FIELD_HELPER}>
      <select
        className="inp"
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || null) as ProductTypeSlug | null)}
      >
        <option value="">Select a product type…</option>
        {PRODUCT_TYPE_DEFS.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.label}
          </option>
        ))}
      </select>
      {selected && <span className="mt-1.5 block text-[12px] text-mute">{selected.blurb}</span>}
    </FieldShell>
  );
}

export function DeliveryContentsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const isSaas = value.includes("Live Operating System / SaaS");
  const isInteractive = !isSaas && value.includes("Live Tool Included");
  const model: ProductDeliveryModel = isSaas ? "saas_os" : isInteractive ? "interactive_tool" : "digital_download";

  const chooseModel = (next: ProductDeliveryModel) => {
    const cleared = value.filter((v) => ![
      "Live Operating System / SaaS",
      "Secure Cloud Dashboard",
      "Authenticated Workspace",
      "Live Tool Included",
    ].includes(v));
    if (next === "saas_os") {
      onChange([...new Set([...cleared, "Live Operating System / SaaS", "Secure Cloud Dashboard", "Authenticated Workspace"])]);
    } else if (next === "interactive_tool") {
      onChange([...cleared, "Live Tool Included"]);
    } else {
      onChange(cleared);
    }
  };

  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  return (
    <div className="space-y-5">
      <ProductDeliveryModelField value={model} onChange={chooseModel} />
      <div>
        <span className="block text-[13px] font-medium text-navy">Delivery Contents</span>
        <span className="mb-2 block text-[12px] text-mute">
          What files, tools or software access does the buyer receive? This is not a category.
        </span>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_CONTENT_OPTIONS.map((opt) => {
            const on = value.includes(opt);
            return (
              <button key={opt} type="button" aria-pressed={on} onClick={() => toggle(opt)}
                className={on ? "min-h-11 rounded-full border border-gold bg-navy px-4 text-[13px] font-semibold text-gold" : "min-h-11 rounded-full border border-ink/15 bg-white px-4 text-[13px] font-medium text-navy hover:border-navy/40"}>
                {opt}
              </button>
            );
          })}
        </div>
        {model === "saas_os" && (
          <p className="mt-3 rounded-lg border border-gold/40 bg-paper p-3 text-xs text-navy">
            SaaS product selected. The primary customer entitlement is authenticated recurring software access; downloads may be included as supporting resources.
          </p>
        )}
      </div>
    </div>
  );
}

export function ProductDeliveryModelField({ value, onChange }: { value: ProductDeliveryModel; onChange: (v: ProductDeliveryModel) => void }) {
  return (
    <fieldset>
      <legend className="block text-[13px] font-medium text-navy">How is this product delivered?</legend>
      <p className="mb-3 text-[12px] text-mute">Choose the commercial product model. This controls whether buyers receive files, a browser tool, or authenticated SaaS access.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {PRODUCT_DELIVERY_MODELS.map((model) => {
          const selected = value === model.slug;
          return (
            <button key={model.slug} type="button" aria-pressed={selected} onClick={() => onChange(model.slug)}
              className={selected ? "min-h-[108px] rounded-xl border-2 border-gold bg-navy p-4 text-left text-white" : "min-h-[108px] rounded-xl border border-ink/15 bg-white p-4 text-left text-navy hover:border-navy/40"}>
              <span className={selected ? "block text-sm font-bold text-gold" : "block text-sm font-bold text-navy"}>{model.label}</span>
              <span className={selected ? "mt-1 block text-xs leading-relaxed text-white/75" : "mt-1 block text-xs leading-relaxed text-mute"}>{model.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
