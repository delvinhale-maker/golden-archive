import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryDef } from "@/lib/categories";

export type Subcategory = {
  id: string;
  category_slug: string;
  name: string;
  position: number;
};

export const SUBCATEGORIES_QUERY_KEY = ["subcategories"] as const;

export async function fetchSubcategories(): Promise<Subcategory[]> {
  const { data, error } = await supabase
    .from("product_subcategories")
    .select("id,category_slug,name,position")
    .order("category_slug", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Subcategory[];
}

export const subcategoriesQuery = queryOptions({
  queryKey: SUBCATEGORIES_QUERY_KEY,
  queryFn: fetchSubcategories,
  staleTime: 60_000,
});

/**
 * Subcategory names for a category, sourced from the admin-managed table.
 * Falls back to the static keyword pills in categories.ts when a category has
 * no managed rows yet.
 */
export function useSubcategoryNames(categorySlugOrLabel?: string | null): string[] {
  const def = getCategoryDef(categorySlugOrLabel);
  const { data } = useQuery(subcategoriesQuery);
  if (!def) return [];
  const managed = (data ?? [])
    .filter((s) => s.category_slug === def.slug)
    .map((s) => s.name);
  return managed.length ? managed : (def.subs ?? []);
}
