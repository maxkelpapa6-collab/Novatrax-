import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { formatFcfa } from "@/lib/commissions";

// Carte vitrine produit Marketplace : grande photo, catégorie, prix clair en
// FCFA. Toute la carte mène vers la fiche produit détaillée.
export default function ProductCard({ product, to, showStatus, statusLabel }) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card hover:shadow-card-hover transition-all"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={product.image_url}
          alt={product.name}
          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          fittingType="fill"
        />
        {product.category && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">
            {product.category}
          </span>
        )}
        {showStatus && statusLabel && (
          <span className="absolute right-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-violet text-white shadow-sm">
            {statusLabel}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
        <p className="mt-auto pt-1.5 font-heading text-lg font-bold text-primary">
          {formatFcfa(product.price_fcfa)}
        </p>
      </div>
    </Link>
  );
}