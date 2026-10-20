import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { Image } from "@/components/ui/image";
import { formatFcfa } from "@/lib/commissions";
import OrderStatusBadge from "@/components/marketplace/OrderStatusBadge";
import { Search, CheckCircle2, XCircle, EyeOff, Trash2, Plus, Ban, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const PRODUCT_STATUS = [
  { value: "pending", label: "À valider" },
  { value: "published", label: "Publiées" },
  { value: "blocked", label: "Bloquées (infractions)" },
  { value: "rejected", label: "Refusées" },
  { value: "hidden", label: "Masquées" },
];

const PRODUCT_STATUS_LABELS = {
  pending: "À valider",
  published: "Publiée",
  blocked: "Bloquée",
  rejected: "Refusée",
  hidden: "Masquée",
};

// Gestion Marketplace (espace administrateur) : validation des annonces,
// modération et sanctions vendeur, catégories et produits interdits,
// commandes, commissions et remboursements. Toute action est journalisée
// côté serveur (fonction marketplaceAdmin + journal d'audit).
export default function MarketplaceAdmin() {
  const [tab, setTab] = useState("annonces");
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-border bg-card p-1.5">
        {[
          { id: "annonces", label: "Annonces" },
          { id: "commandes", label: "Commandes & commissions" },
          { id: "regles", label: "Catégories & règles" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.id ? "gradient-novatrax text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "annonces" && <AdminProducts />}
        {tab === "commandes" && <AdminOrders />}
        {tab === "regles" && <AdminRules />}
      </div>
    </div>
  );
}

function invokeAdmin(payload) {
  return api.functions.invoke("marketplaceAdmin", payload).then((res) => res.data || {});
}

// ---------- Annonces : modération ----------
function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("pending");
  const [reasonFor, setReasonFor] = useState(null); // { decision, product } en attente de motif
  const [reasonText, setReasonText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = {};
      if (status !== "all") query.status = status;
      if (debounced) query.name = { $regex: debounced.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      const page = await api.entities.MarketplaceProduct.filter(query, { sort: "-created_date", limit: 100 });
      setProducts(page.items || []);
    } finally {
      setLoading(false);
    }
  }, [debounced, status]);

  useEffect(() => { load(); }, [load]);

  const act = async (payload) => {
    setBusy(true);
    try {
      await invokeAdmin(payload);
      setReasonFor(null);
      setReasonText("");
      load();
    } catch (e) {
      toast({ title: "Action impossible", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const startReason = (decision, product) => { setReasonFor({ decision, product }); setReasonText(""); };
  const submitReason = () => {
    if (!reasonFor || reasonText.trim().length < 5) return;
    const payload = { action: reasonFor.decision === "seller_ban" ? "seller_ban" : "product_moderate", product_id: reasonFor.product.id, reason: reasonText.trim() };
    if (reasonFor.decision !== "seller_ban") payload.decision = reasonFor.decision;
    else payload.user_id = reasonFor.product.seller_id;
    act(payload);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une annonce…"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
          {PRODUCT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          <option value="all">Toutes les annonces</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">Aucune annonce dans cette vue.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {p.image_url && <Image src={p.image_url} alt={p.name} className="h-full w-full" fittingType="fill" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{p.name}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{PRODUCT_STATUS_LABELS[p.status] || p.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatFcfa(p.price_fcfa)} • {p.category} • Vendeur : {p.seller_name || p.seller_email} (📞 {p.seller_phone})
                  </p>
                  {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{p.description}</p>}
                  {(p.blocked_reason || p.rejection_reason) && (
                    <p className="mt-1 text-xs text-destructive">{p.blocked_reason || p.rejection_reason}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-1.5">
                  {p.status === "pending" && (
                    <>
                      <ActionBtn icon={CheckCircle2} label="Valider" tone="ok" disabled={busy} onClick={() => act({ action: "product_moderate", product_id: p.id, decision: "approve" })} />
                      <ActionBtn icon={XCircle} label="Refuser" tone="bad" disabled={busy} onClick={() => startReason("reject", p)} />
                    </>
                  )}
                  {p.status === "published" && (
                    <ActionBtn icon={EyeOff} label="Masquer" disabled={busy} onClick={() => act({ action: "product_moderate", product_id: p.id, decision: "hide" })} />
                  )}
                  {p.status === "hidden" && (
                    <ActionBtn icon={CheckCircle2} label="Publier" tone="ok" disabled={busy} onClick={() => act({ action: "product_moderate", product_id: p.id, decision: "show" })} />
                  )}
                  {p.status === "blocked" && (
                    <>
                      <ActionBtn icon={RotateCcw} label="Réexaminer (recours)" disabled={busy} onClick={() => act({ action: "product_moderate", product_id: p.id, decision: "unblock" })} />
                      <ActionBtn icon={Ban} label="Bannir le vendeur" tone="bad" disabled={busy} onClick={() => startReason("seller_ban", p)} />
                    </>
                  )}
                  <ActionBtn icon={Trash2} label="Supprimer" tone="bad" disabled={busy} onClick={() => { if (window.confirm(`Supprimer « ${p.name} » ?`)) act({ action: "product_moderate", product_id: p.id, decision: "delete" }); }} />
                </div>
              </div>
              {reasonFor?.product?.id === p.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3">
                  <input
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder={reasonFor.decision === "seller_ban" ? "Motif du bannissement définitif…" : "Motif du refus (envoyé au vendeur)…"}
                    className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button onClick={submitReason} disabled={busy || reasonText.trim().length < 5} className="inline-flex items-center gap-1.5 rounded-xl gradient-novatrax px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirmer
                  </button>
                  <button onClick={() => setReasonFor(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold">Annuler</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, tone, ...props }) {
  const cls = tone === "ok"
    ? "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5"
    : tone === "bad"
      ? "border-destructive/30 text-destructive hover:bg-destructive/5"
      : "border-border text-foreground hover:bg-muted";
  return (
    <button {...props} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// ---------- Commandes : suivi, commissions, remboursements ----------
function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = status === "all" ? {} : { status };
      const page = await api.entities.MarketplaceOrder.filter(query, { sort: "-created_date", limit: 100 });
      setOrders(page.items || []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (order, decision) => {
    const note = window.prompt(decision === "refund" ? "Note de remboursement (visible dans l'historique) :" : "Note de décision :", "") || "";
    setBusy(true);
    try {
      await invokeAdmin({ action: "order_resolve", order_id: order.id, decision, note });
      toast({ title: decision === "refund" ? "Commande remboursée" : "Vente terminée", description: "Les écritures portefeuille ont été mises à jour." });
      load();
    } catch (e) {
      toast({ title: "Action impossible", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
          <option value="all">Toutes les commandes</option>
          <option value="awaiting_payment">En attente de paiement</option>
          <option value="processing">Paiement confirmé — en cours</option>
          <option value="disputed">En litige</option>
          <option value="completed">Terminées</option>
          <option value="refunded">Remboursées</option>
          <option value="cancelled">Annulées</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">Aucune commande dans cette vue.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{o.product_name}</p>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {o.order_ref} • Acheteur : {o.buyer_name || o.buyer_email} (📞 {o.buyer_phone || "—"}) • Vendeur : {o.seller_name || o.seller_email} (📞 {o.seller_phone})
                  </p>
                  <p className="mt-1 text-xs">
                    <span className="font-semibold">Prix {formatFcfa(o.product_price_fcfa)}</span>
                    {" — commission NOVATRAX "}<span className="font-semibold text-primary">{formatFcfa(o.commission_fcfa)}</span>
                    {" — net vendeur "}<span className="font-semibold text-emerald-600">{formatFcfa(o.net_fcfa)}</span>
                  </p>
                  {o.dispute_reason && <p className="mt-1 text-xs text-destructive">Litige : {o.dispute_reason}</p>}
                  {o.resolution_note && <p className="mt-1 text-xs text-muted-foreground">Décision : {o.resolution_note}</p>}
                </div>
                {["processing", "disputed", "completed"].includes(o.status) && (
                  <div className="flex flex-wrap gap-1.5">
                    {o.status !== "completed" && (
                      <ActionBtn icon={CheckCircle2} label="Terminer & créditer" tone="ok" disabled={busy} onClick={() => resolve(o, "complete")} />
                    )}
                    <ActionBtn icon={RotateCcw} label="Rembourser l'acheteur" tone="bad" disabled={busy} onClick={() => resolve(o, "refund")} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Catégories autorisées & produits interdits ----------
function AdminRules() {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [newRule, setNewRule] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catPage, rulePage] = await Promise.all([
        api.entities.MarketplaceCategory.filter({}, { sort: "sort_order", limit: 100 }),
        api.entities.MarketplaceRule.filter({}, { sort: "-created_date", limit: 200 }),
      ]);
      setCategories(catPage.items || []);
      setRules(rulePage.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (payload) => {
    setBusy(true);
    try {
      await invokeAdmin(payload);
      load();
    } catch (e) {
      toast({ title: "Action impossible", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (name.length < 2) return;
    run({ action: "category_save", name });
    setNewCategory("");
  };
  const addRule = () => {
    const value = newRule.trim();
    if (value.length < 3) return;
    run({ action: "rule_create", value });
    setNewRule("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-heading font-bold">Catégories autorisées</h3>
        <p className="mt-1 text-xs text-muted-foreground">Seuls les produits de ces catégories peuvent être publiés par les vendeurs.</p>
        <div className="mt-3 flex gap-2">
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Ex. Électronique & téléphones"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <button onClick={addCategory} disabled={busy || newCategory.trim().length < 2} className="inline-flex items-center gap-1.5 rounded-xl gradient-novatrax px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
        {loading ? (
          <div className="mt-3 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.active ? "Ouverte aux annonces" : "Fermée"}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => run({ action: "category_save", id: c.id, name: c.name, active: c.active !== true })} disabled={busy}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${c.active ? "border-amber-500/30 text-amber-600 hover:bg-amber-500/5" : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5"}`}>
                    {c.active ? "Désactiver" : "Activer"}
                  </button>
                  <button onClick={() => { if (window.confirm(`Supprimer la catégorie « ${c.name} » ?`)) run({ action: "category_delete", id: c.id }); }} disabled={busy}
                    className="rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5">
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Aucune catégorie. Créez-en une pour ouvrir la Marketplace.</p>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-heading font-bold">Produits & contenus interdits</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tout produit dont le nom ou la description contient l'un de ces mots-clés est bloqué automatiquement. Les liens externes sont toujours interdits.
        </p>
        <div className="mt-3 flex gap-2">
          <input value={newRule} onChange={(e) => setNewRule(e.target.value)} placeholder="Ex. netflix, crack, compte novatrax…"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          <button onClick={addRule} disabled={busy || newRule.trim().length < 3} className="inline-flex items-center gap-1.5 rounded-xl gradient-novatrax px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
        {loading ? (
          <div className="mt-3 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {rules.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold">
                {r.value}
                <button onClick={() => run({ action: "rule_delete", id: r.id })} disabled={busy} className="text-destructive hover:text-destructive/70" aria-label="Supprimer">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {rules.length === 0 && <p className="text-sm text-muted-foreground">Aucune règle spécifique. Ajoutez les mots-clés à interdire.</p>}
          </div>
        )}
      </div>
    </div>
  );
}