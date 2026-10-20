import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/commissions";
import { ArrowLeft, Loader2, Phone, ShieldCheck, BadgeCheck, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Fiche produit : grande photo haute qualité, nom, prix et coordonnées du
// vendeur. L'achat passe par la passerelle de paiement de la plateforme —
// le paiement n'est confirmé que par le prestataire, côté serveur.
export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    setLoading(true);
    base44.entities.MarketplaceProduct.get(id)
      .then((p) => setProduct(p))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  const ownProduct = product && user && product.seller_id === user.id;

  const buy = async () => {
    if (!product || buying) return;
    setBuying(true);
    try {
      const res = await base44.functions.invoke("marketplacePurchase", { product_id: product.id });
      const data = res.data || {};
      if (data.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      throw new Error(data.error || "Paiement indisponible.");
    } catch (e) {
      const message = (e?.response?.data?.error) || (e?.message) || "Le paiement n'a pas pu être lancé.";
      toast({ title: "Achat impossible", description: message, variant: "destructive" });
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="aspect-[16/10] rounded-2xl bg-muted/50 animate-pulse" />
        <div className="mt-4 h-8 w-2/3 rounded-xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (!product || product.status !== "published") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-heading text-2xl font-bold">Produit introuvable</h1>
        <p className="mt-2 text-muted-foreground">Ce produit n'est plus disponible sur la Marketplace.</p>
        <Link to="/marketplace" className="mt-6 inline-flex items-center gap-1.5 rounded-xl gradient-novatrax px-5 py-2.5 text-sm font-semibold text-white">
          Retour à la Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-muted shadow-card">
          <Image src={product.image_url} alt={product.name} className="aspect-[4/3] h-full w-full" fittingType="fill" />
        </div>

        <div className="flex flex-col">
          {product.category && (
            <span className="inline-flex w-fit items-center rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
              {product.category}
            </span>
          )}
          <h1 className="mt-3 font-heading text-2xl sm:text-3xl font-bold">{product.name}</h1>
          <p className="mt-3 font-heading text-3xl font-bold text-primary">{formatFcfa(product.price_fcfa)}</p>

          {product.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{product.description}</p>
          )}

          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendeur</p>
            <div className="mt-1.5 flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-primary" />
              <p className="font-semibold">{product.seller_name || "Membre NOVATRAX"}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Contact direct :</p>
            <a href={`tel:${product.seller_phone}`} className="mt-1 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              <Phone className="h-4 w-4" /> {product.seller_phone}
            </a>
          </div>

          {ownProduct ? (
            <div className="mt-5 rounded-2xl border border-border bg-muted/50 p-4 text-sm font-semibold text-muted-foreground">
              Ceci est votre annonce. Retrouvez-la dans <Link to="/ma-boutique" className="text-primary underline">Ma boutique</Link>.
            </div>
          ) : (
            <>
              <Button
                onClick={buy}
                disabled={buying}
                className="mt-5 h-12 w-full rounded-xl gradient-novatrax text-base font-bold text-white shadow-card hover:shadow-card-hover"
              >
                {buying ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                {buying ? "Ouverture du paiement sécurisé…" : "Acheter maintenant"}
              </Button>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Paiement sécurisé par NOVATRAX (Mobile Money). Le vendeur est payé après validation de la vente ; vous confirmez la réception dans « Mes achats ».
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}