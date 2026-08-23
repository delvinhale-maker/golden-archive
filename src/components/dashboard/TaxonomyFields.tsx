import {
  CATEGORY_FIELD_HELPER,
  DELIVERY_CONTENT_OPTIONS,
  PRODUCT_TYPE_DEFS,
  PRODUCT_TYPE_FIELD_HELPER,
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
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <div>
      <span className="block text-[13px] font-medium text-navy">Delivery Contents</span>
      <span className="mb-2 block text-[12px] text-mute">
        What files or tools does the buyer receive? This is not a category.
      </span>
      <div className="flex flex-wrap gap-2">
        {DELIVERY_CONTENT_OPTIONS.map((opt) => {
          const on = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(opt)}
              className={
                on
                  ? "min-h-11 rounded-full border border-gold bg-navy px-4 text-[13px] font-semibold text-gold"
                  : "min-h-11 rounded-full border border-ink/15 bg-white px-4 text-[13px] font-medium text-navy hover:border-navy/40"
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
