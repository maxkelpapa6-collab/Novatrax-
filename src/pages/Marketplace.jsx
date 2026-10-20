import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, Store, ShoppingBag, ChevronDown, Loader2 } from "lucide-react";
import ProductCard from "@/components/marketplace/ProductCard";

const PAGE_SIZE = 30;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Vitrine Marketplace : produits récemment publiés, recherche par nom,
// filtres par catégorie et par prix — chaque filtre est appliqué côté serveur.
export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState("-created_date");

  useEffect(() => {
    base44.entities.MarketplaceCategory.filter({ active: true }, { sort: "sort_order", limit: 100 })
      .then((p) => setCategories((p.items || []).map((c) => c.name)))
      .catch(() => setCategories([]));
  }, []);

  // La recherche est légèrement diffée pour éviter un appel serveur par touche.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildQuery = useCallback(() => {
    const query = { status: "published" };
    if (debounced) query.name = { $regex: escapeRegex(debounced), $options: "i" };
    if (category) query.category = category;
    const min = Math.round(Number(priceMin));
    const max = Math.round(Number(priceMax));
    const price = {};
    if (Number.isFinite(min) && min > 0) price.$gte = min;
    if (Number.isFinite(max) && max > 0) price.$lte = max;
    if (Object.keys(price).length) query.price_fcfa = price;
    return query;
  }, [debounced, category, priceMin, priceMax]);

  const load = useCallback(
    async (withLoading = true) => {
      if (withLoading) setLoading(true);
      try {
        const page = await base44.entities.MarketplaceProduct.filter(buildQuery(), {
          sort,
          limit: PAGE_SIZE,
        });
        setProducts(page.items || []);
        setCursor(page.next_cursor || null);
        setHasMore(!!page.has_more);
      } finally {
        if (withLoading) setLoading(false);
      }
    },
    [buildQuery, sort]
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await base44.entities.MarketplaceProduct.filter(buildQuery(), {
        sort,
        limit: PAGE_SIZE,
        cursor,
      });
      setProducts((prev) => [...prev, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } finally {
      setLoadingMore(false);
    }
  };

  const field = "rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary bg-background";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
            <ShoppingBag className="h-3.5 w-3.5" /> Marketplace NOVATRAX
          </span>
          <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold">Achetez et vendez en toute confiance</h1>
          <p className="mt-2 text-muted-foreground">
            Paiement sécurisé par la plateforme, commission de 10 % — le vendeur reçoit 90 % de chaque vente validée.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/ma-boutique" className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-4 py-2.5 text-sm font-semibold text-white shadow-card">
            <Store className="h-4 w-4" /> Ma boutique
          </Link>
          <Link to="/mes-achats" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
            <ShoppingBag className="h-4 w-4" /> Mes achats
          </Link>
        </div>
      </div>

      {/* Recherche et filtres : appliqués côté serveur à chaque changement */}
      <div className="mt-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit par nom…"
            className={`${field} w-full pl-10`}
          />
        </div>
        <div className="flex flex-wrap gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCategory("")}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${!category ? "gradient-novatrax text-white" : "border border-border text-muted-foreground hover:bg-muted"}`}
          >
            Toutes
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? "" : c)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${category === c ? "gradient-novatrax text-white" : "border border-border text-muted-foreground hover:bg-muted"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} inputMode="numeric" placeholder="Prix min (FCFA)" className={`${field} w-40`} />
          <span className="text-muted-foreground text-sm">—</span>
          <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} inputMode="numeric" placeholder="Prix max (FCFA)" className={`${field} w-40`} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={field}>
            <option value="-created_date">Plus récents</option>
            <option value="price_fcfa">Prix croissant</option>
            <option value="-price_fcfa">Prix décroissant</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Aucun produit ne correspond à votre recherche.</p>
          <p className="mt-1 text-sm text-muted-foreground">Explorez d'autres catégories ou revenez bientôt : de nouvelles annonces arrivent.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} to={`/marketplace/produit/${p.id}`} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button onClick={loadMore} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
            Charger plus de produits
          </button>
        </div>
      )}
    </div>
  );
}