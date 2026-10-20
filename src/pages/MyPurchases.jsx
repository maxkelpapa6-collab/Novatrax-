import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { Image } from "@/components/ui/image";
import { formatFcfa } from "@/lib/commissions";
import OrderStatusBadge from "@/components/marketplace/OrderStatusBadge";
import { ShoppingBag, Phone, CheckCircle2, AlertTriangle, Loader2, Info } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Mes achats : suivi des commandes passées sur la Marketplace. Le paiement
// n'apparaît confirmé que lorsque le prestataire l'a validé (webhook serveur) ;
// l'acheteur clôt la vente en confirmant la réception, ce qui crédite le vendeur.
export default function MyPurchases() {
  const { user } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const returnOrder = params.get("order") || "";
  const returnResult = params.get("result") || "";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [disputeFor, setDisputeFor] = useState(null);
  const [disputeText, setDisputeText] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const page = await api.entities.MarketplaceOrder.filter(
        { buyer_id: user.id },
        { sort: "-created_date", limit: 50 }
      );
      setOrders(page.items || []);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
    // Temps réel : la confirmation de paiement par le prestataire met à jour
    // le statut de la commande sans rechargement manuel.
    const unsubscribe = api.entities.MarketplaceOrder.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  const confirmReceipt = async (order) => {
    if (busyId) return;
    if (!window.confirm(`Confirmer la réception de « ${order.product_name} » ? Le vendeur recevra son net (${formatFcfa(order.net_fcfa)}).`)) return;
    setBusyId(order.id);
    try {
      await api.functions.invoke("marketplaceOrder", { action: "confirm_receipt", order_id: order.id });
      toast({ title: "Réception confirmée", description: "Le vendeur a été crédité de son net. Merci !" });
      load();
    } catch (e) {
      toast({ title: "Confirmation impossible", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const submitDispute = async (order) => {
    if (busyId) return;
    setBusyId(order.id);
    try {
      await api.functions.invoke("marketplaceOrder", {
        action: "dispute",
        order_id: order.id,
        reason: disputeText.trim(),
      });
      toast({ title: "Litige ouvert", description: "L'administration NOVATRAX examine votre demande." });
      setDisputeFor(null);
      setDisputeText("");
      load();
    } catch (e) {
      toast({ title: "Litige impossible", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
            <ShoppingBag className="h-3.5 w-3.5" /> Mes achats
          </span>
          <h1 className="mt-3 font-heading text-3xl font-bold">Suivi de mes commandes</h1>
          <p className="mt-2 text-muted-foreground">Confirmez la réception de vos produits pour finaliser la vente et payer le vendeur.</p>
        </div>
        <Link to="/marketplace" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
          <ShoppingBag className="h-4 w-4" /> Retour à la Marketplace
        </Link>
      </div>

      {returnOrder && returnResult === "retour" && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <span className="font-semibold">Paiement transmis ({returnOrder}).</span>{" "}
            La confirmation définitive est vérifiée auprès du prestataire : le statut de votre commande se met à jour automatiquement.
          </p>
        </div>
      )}
      {returnOrder && returnResult === "annule" && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-border bg-muted/50 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p><span className="font-semibold">Paiement annulé ({returnOrder}).</span> Aucun montant n'a été débité.</p>
        </div>
      )}

      {loading ? (
        <div className="mt-6 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Aucun achat pour le moment.</p>
          <p className="mt-1 text-sm text-muted-foreground">Explorez la Marketplace et trouvez votre premier produit.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {o.product_image ? (
                    <Image src={o.product_image} alt={o.product_name} className="h-full w-full" fittingType="fill" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-6 w-6 text-muted-foreground" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{o.product_name}</p>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{o.order_ref} • {formatFcfa(o.product_price_fcfa)}</p>
                  <p className="mt-1 text-sm">
                    Vendeur : {o.seller_name || o.seller_email}{" "}
                    {o.seller_phone && (
                      <a href={`tel:${o.seller_phone}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" /> {o.seller_phone}
                      </a>
                    )}
                  </p>
                  {o.status === "awaiting_payment" && o.checkout_url && (
                    <button
                      onClick={() => (window.location.href = o.checkout_url)}
                      className="mt-2 inline-flex items-center gap-2 rounded-xl gradient-novatrax px-4 py-2 text-sm font-semibold text-white"
                    >
                      Reprendre le paiement
                    </button>
                  )}
                  {o.status === "processing" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => confirmReceipt(o)}
                        disabled={busyId === o.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        {busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Confirmer la réception
                      </button>
                      {disputeFor !== o.id ? (
                        <button
                          onClick={() => setDisputeFor(o.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3.5 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5"
                        >
                          <AlertTriangle className="h-4 w-4" /> Signaler un problème
                        </button>
                      ) : (
                        <div className="w-full space-y-2">
                          <textarea
                            value={disputeText}
                            onChange={(e) => setDisputeText(e.target.value)}
                            placeholder="Décrivez le problème rencontré (livraison non reçue, produit non conforme…)"
                            className="min-h-[70px] w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitDispute(o)}
                              disabled={busyId === o.id || disputeText.trim().length < 10}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Envoyer le litige
                            </button>
                            <button onClick={() => { setDisputeFor(null); setDisputeText(""); }} className="rounded-xl border border-border px-3.5 py-2 text-sm font-semibold">
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {o.status === "disputed" && o.dispute_reason && (
                    <p className="mt-2 text-xs text-destructive">Litige en cours d'examen : {o.dispute_reason}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}