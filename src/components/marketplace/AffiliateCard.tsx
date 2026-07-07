import { ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  type AffiliateProduct,
  SOURCE_LABEL,
  logAffiliateClick,
} from "@/lib/affiliate";

type Props = {
  product: AffiliateProduct;
  className?: string;
};

export function AffiliateCard({ product, className = "" }: Props) {
  const { user } = useAuth();
  const onGo = () => logAffiliateClick(product, user?.id);

  const sourceCls =
    product.source === "amazon"
      ? "bg-[#FF9900] text-[#0F1E35]"
      : "bg-[#0071CE] text-white";

  const hasStrike =
    product.original_price !== null &&
    product.original_price !== undefined &&
    Number(product.original_price) > Number(product.price);

  return (
    <a
      href={product.affiliate_url}
      target="_blank"
      rel="nofollow sponsored noopener"
      onClick={onGo}
      onAuxClick={onGo}
      className={`av-card group block overflow-hidden rounded-2xl border border-transparent bg-white transition hover:-translate-y-1 hover:border-gold hover:shadow-card-hover ${className}`}
    >
      <div className="relative aspect-[1/1] bg-[#f5f4ef] overflow-hidden">
        <img
          src={product.image_url}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = "0.25";
          }}
        />
        <span
          className={`absolute left-2 top-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sourceCls}`}
        >
          {SOURCE_LABEL[product.source]}
        </span>
        {product.badge && (
          <span className="absolute right-2 top-2 inline-flex items-center rounded-full bg-navy px-2.5 py-0.5 text-[10px] font-bold text-gold-ink">
            {product.badge}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="text-[10px] font-semibold tracking-caps text-gold-ink uppercase">
          {product.category}
        </div>
        <div className="mt-1 line-clamp-2 font-display text-sm font-bold text-ink min-h-[2.5rem]">
          {product.title}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-base font-bold text-gold-ink">
            ${Number(product.price).toFixed(2)}
          </span>
          {hasStrike && (
            <span className="text-xs text-mute line-through">
              ${Number(product.original_price).toFixed(2)}
            </span>
          )}
        </div>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onGo();
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-gold/60 px-3 py-1.5 text-xs font-bold text-navy transition group-hover:bg-gold group-hover:text-navy"
        >
          View on {SOURCE_LABEL[product.source]} <ExternalLink size={11} />
        </span>
      </div>
    </a>
  );
}
