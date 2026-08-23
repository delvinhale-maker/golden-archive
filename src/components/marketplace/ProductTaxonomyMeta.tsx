import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deliverySummary, productBadges } from "@/lib/taxonomy";

/**
 * Compact premium metadata block: at most two badges plus a single metadata
 * line (file count + delivery formats). Reads the same taxonomy source of
 * truth as the filters, seller flow and library.
 */
export function ProductTaxonomyMeta({
  productId,
  productType,
  category,
  subcategory,
  deliveryContents,
}: {
  productId: string;
  productType?: string | null;
  category?: string | null;
  subcategory?: string | null;
  deliveryContents?: string[] | null;
}) {
  const { data: fileCount } = useQuery({
    queryKey: ["delivery-file-count", productId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("product_download_files" as any)
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const badges = productBadges({
    product_type: productType,
    category,
    subcategory,
    delivery_contents: deliveryContents,
  });
  const formats = deliverySummary(deliveryContents);
  const metaParts: string[] = [];
  if (fileCount && fileCount > 1) metaParts.push(`${fileCount} Files Included`);
  if (formats) metaParts.push(formats);

  if (!badges.length && !metaParts.length) return null;

  return (
    <div className="mt-3">
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-gold/60 bg-navy px-3 py-1 text-[11px] font-bold uppercase tracking-caps text-gold"
            >
              {b}
            </span>
          ))}
        </div>
      )}
      {metaParts.length > 0 && (
        <p className="mt-2 text-[13px] text-mute">{metaParts.join(" · ")}</p>
      )}
    </div>
  );
}
