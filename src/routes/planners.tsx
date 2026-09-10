import { createFileRoute } from "@tanstack/react-router";
import { CommercialCategoryLanding } from "@/components/marketplace/CommercialCategoryLanding";
import {
  COMMERCIAL_CATEGORY_PAGES,
  commercialCategoryHead,
} from "@/lib/commercial-category-pages";
import { getProducts } from "@/lib/marketplace.functions";

const CONFIG = COMMERCIAL_CATEGORY_PAGES.planners;

export const Route = createFileRoute("/planners")({
  loader: () =>
    getProducts({
      data: { category: "financial_planners", page: 1, pageSize: 60 },
    }),
  head: () => commercialCategoryHead(CONFIG),
  component: CategoryPage,
});

function CategoryPage() {
  const listing = Route.useLoaderData();
  return <CommercialCategoryLanding config={CONFIG} products={listing.items} />;
}
