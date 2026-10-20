import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useMemberHome } from "@/hooks/useMemberHome";
import { formatFcfa } from "@/lib/commissions";
import FeatureLocked from "@/components/FeatureLocked";
import ProductCard from "@/components/marketplace/ProductCard";
import OrderStatusBadge from "@/components/marketplace/OrderStatusBadge";
import ProductForm from "@/components/marketplace/ProductForm";
import { Store, Plus, Pencil, Trash2, Wallet, Clock3, BadgeCheck, Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const STATUS_LABELS = {
  pending: "En validation",
  published: "Publiée",
  rejected: "Refusée",
  blocked: "Bloquée",
  hidden: "Masquée",
};

// Espace vendeur : gestion des annonces (publication avec aperçu et vérification
// automatique) et suivi des ventes — prix, commission 10 %, net 90 % perçu et
// gains en attente de validation. Le crédit du vendeur reste décidé côté serveur.
export default function MyShop() {
  const { user } = useAuth();
  const { data: homeData } = useMemberHome();
  const balance = homeData?.stats?.balance ?? 0;
  const [tab, setTab] = useState("annonces");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | product
  const [submitting, setSubmitting] = useState(false);

  const canSell = user?.role === "admin" || user?.access_activated === true;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const page = await base44.entities.MarketplaceProduct.filter(
        { seller_id: user.id },
        { sort: "-created_date", limit: 50 }
      );
      setProducts(page.items || []);
    } catch (e) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
    base44.entities.MarketplaceCategory.filter({ active: true }, { sort: "sort_order", limit: 100 })
      .then((p) => setCategories((p.items || []).map((c) => c.name)))
      .catch(() => setCategories([]));
  }, [load]);

  const submitProduct = async (data) => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("marketplaceProduct", {
        action: editing === "new" ? "create" : "update",
        product_id: editing !== "new" ? editing.id : undefined,
        ...data,
      });
      const result = res.data || {};
      if (result.blocked) {
        toast({
          title: "Annonce bloquée automatiquement",
          description: result.reason,
          variant: "destructive",
        });
      } else {
        toast({ title: "Annonce envoyée", description: "Elle sera publiée après validation par l'administration." });
      }
      setEditing(null);
      load();
    } catch (e) {
      toast({
        title: "Publication impossible",
        description: e?.response?.data?.error || e?.message || "Réessayez.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Supprimer l'annonce « ${product.name} » ?`)) return;
    try {
      await base44.functions.invoke("marketplaceProduct", { action: "delete", product_id: product.id });
      toast({ title: "Annonce supprimée" });
      load();
    } catch (e) {
      toast({ title: "Suppression impossible", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    }
  };

  if (!canSell) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <h1 className="mb-4 font-heading text-3xl font-bold">Ma boutique</h1>
        <FeatureLocked title="Vendre sur la Marketplace" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
            <Store className="h-3.5 w-3.5" /> Ma boutique
          </span>
          <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold">Mon espace vendeur</h1>
          <p className="mt-2 text-muted-foreground">
            Publiez vos produits autorisés : commission NOVATRAX 10 %, vous recevez 90 % de chaque vente validée dans votre portefeuille.
          </p>
        </div>
        <Link to="/marketplace" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
          <Search className="h-4 w-4" /> Voir la Marketplace
        </Link>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-border bg-card p-1.5 shadow-card">
        {[
          { id: "annonces", label: "Mes annonces", icon: Store },
          { id: "ventes", label: "Mes ventes", icon: BadgeCheck },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id ? "gradient-novatrax text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "annonces" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-bold">Mes annonces</h2>
            <button
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-4 py-2.5 text-sm font-semibold text-white shadow-card"
            >
              <Plus className="h-4 w-4" /> Publier une annonce
            </button>
          </div>

          {editing && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-heading font-bold">
                {editing === "new" ? "Nouvelle annonce" : "Modifier l'annonce"}
              </h3>
              <ProductForm
                categories={categories}
                defaultPhone={user?.phone || ""}
                initial={editing === "new" ? null : editing}
                submitting={submitting}
                onSubmit={submitProduct}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/50 animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
              <Store className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Vous n'avez publié aucune annonce.</p>
              <p className="mt-1 text-sm text-muted-foreground">Créez votre première annonce : photo, prix, catégorie et votre numéro de contact.</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {products.map((p) => (
                <div key={p.id} className="space-y-1.5">
                  <ProductCard
                    product={p}
                    to={`/marketplace/produit/${p.id}`}
                    showStatus={p.status !== "published"}
                    statusLabel={STATUS_LABELS[p.status] || p.status}
                  />
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {p.status !== "published" && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.status === "blocked" || p.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    )}
                    <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">
                      <Pencil className="h-3 w-3" /> Modifier
                    </button>
                    <button onClick={() => removeProduct(p)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/5">
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </button>
                  </div>
                  {(p.status === "blocked" || p.status === "rejected") && (p.blocked_reason || p.rejection_reason) && (
                    <p className="px-1 text-[11px] text-destructive leading-snug">{p.blocked_reason || p.rejection_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "ventes" && <SalesTab user={user} balance={balance} />}
    </div>
  );
}

function SalesTab({ user, balance }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      base44.entities.MarketplaceOrder.filter({ seller_id: user.id }, { sort: "-created_date", limit: 50 }),
      base44.entities.MarketplaceOrder.aggregate({
        query: { seller_id: user.id },
        groupBy: "status",
        sum: ["net_fcfa", "commission_fcfa"],
      }),
    ])
      .then(([page, agg]) => {
        if (!alive) return;
        setOrders(page.items || []);
        const byStatus = {};
        for (const row of agg.rows || []) byStatus[row.status] = row;
        setTotals({
          pending: byStatus.processing?.sum_net_fcfa || 0,
          paid: byStatus.completed?.sum_net_fcfa || 0,
          commissions: Object.values(byStatus).reduce((acc, r) => acc + (r.sum_commission_fcfa || 0), 0),
        });
      })
      .catch(() => alive && setOrders([]))
      .finally(() => alive && setLoading(false));
    // Temps réel : le statut des commandes se met à jour sans rechargement.
    const unsubscribe = base44.entities.MarketplaceOrder.subscribe(() => {
      if (alive) setLoading(true);
    });
    return () => { alive = false; unsubscribe(); };
  }, [user?.id]);

  const cards = [
    { label: "Solde disponible (portefeuille)", value: formatFcfa(balance), icon: Wallet, color: "bg-primary/10 text-primary" },
    { label: "Gains en attente de validation", value: totals ? formatFcfa(totals.pending) : "…", icon: Clock3, color: "bg-amber-500/10 text-amber-600" },
    { label: "Gains nets versés", value: totals ? formatFcfa(totals.paid) : "…", icon: BadgeCheck, color: "bg-emerald-500/10 text-emerald-600" },
    { label: "Commissions NOVATRAX (10 %)", value: totals ? formatFcfa(totals.commissions) : "…", icon: Store, color: "bg-violet/10 text-violet" },
  ];

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${c.color}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 font-heading text-xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <BadgeCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Aucune vente pour le moment.</p>
          <p className="mt-1 text-sm text-muted-foreground">Vos commandes apparaîtront ici dès qu'un membre achètera l'un de vos produits.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold truncate">{o.product_name}</p>
                  <OrderStatusBadge status={o.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {o.order_ref} • Acheteur : {o.buyer_name || o.buyer_email} • {o.buyer_phone ? `📞 ${o.buyer_phone}` : "contact par e-mail"}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-heading font-bold text-primary">{formatFcfa(o.net_fcfa)}</p>
                <p className="text-[11px] text-muted-foreground">
                  Prix {formatFcfa(o.product_price_fcfa)} − commission {formatFcfa(o.commission_fcfa)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}