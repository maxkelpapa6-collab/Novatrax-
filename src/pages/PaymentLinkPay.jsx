import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { LOGO_URL } from "@/components/Logo";
import { formatFcfa } from "@/lib/commissions";
import { Loader2, ShieldCheck, CreditCard, Clock3, XCircle } from "lucide-react";

// Page publique de paiement par lien : accessible sans compte NOVATRAX, depuis
// n'importe quel pays. Le payeur voit le profil, la description et le prix ;
// le paiement passe par la passerelle LeekPay de la plateforme — la
// confirmation reste côté serveur (webhook), jamais dans le navigateur.
export default function PaymentLinkPay() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    base44.entities.PaymentLink.get(id)
      .then((l) => {
        setLink(l);
        if (l?.price_type === "variable" && l?.min_fcfa != null) setAmount(String(l.min_fcfa));
      })
      .catch(() => setLink(null))
      .finally(() => setLoading(false));
  }, [id]);

  const result = searchParams.get("result");
  const paymentRef = searchParams.get("payment");

  const pay = async () => {
    if (!link || paying) return;
    setPaying(true);
    setError("");
    try {
      const payload = { link_id: link.id };
      if (link.price_type === "variable") payload.amount_fcfa = Math.round(Number(amount));
      if (payerName.trim()) payload.payer_name = payerName.trim();
      const res = await base44.functions.invoke("paymentLinkPay", payload);
      const data = res.data || {};
      if (data.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      throw new Error(data.error || "Paiement indisponible.");
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Le paiement n'a pas pu être lancé.");
      setPaying(false);
    }
  };

  const variableAmount = Math.round(Number(amount));
  const amountValid =
    link?.price_type !== "variable" ||
    (Number.isFinite(variableAmount) && variableAmount >= link.min_fcfa && variableAmount <= link.max_fcfa);
  const payLabel = link?.price_type === "fixed"
    ? `Payer ${formatFcfa(link.price_fcfa)}`
    : Number.isFinite(variableAmount) && amountValid
      ? `Payer ${formatFcfa(variableAmount)}`
      : "Payer";

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary via-background to-background">
      <header className="flex flex-col items-center gap-1 px-4 py-6">
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl shadow-sm">
          <Image src={LOGO_URL} alt="NOVATRAX" className="h-full w-full" fittingType="fill" />
        </span>
        <span className="font-heading text-sm font-extrabold tracking-tight">NOVA<span className="text-gradient-novatrax">TRAX</span></span>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-14">
        {result && (
          <div className={`mb-4 flex items-start gap-3 rounded-2xl border p-4 text-sm ${result === "retour" ? "border-primary/30 bg-primary/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            {result === "retour" ? <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
            <div>
              <p className="font-semibold">
                {result === "retour" ? "Paiement en cours de vérification" : "Paiement annulé"}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {result === "retour"
                  ? "Merci ! La confirmation de votre paiement est en cours — le bénéficiaire est crédité dès la validation par la plateforme."
                  : "Votre paiement n'a pas abouti : aucun montant n'a été débité. Vous pouvez réessayer."}
              </p>
              {paymentRef && <p className="mt-1 text-xs text-muted-foreground/80">Référence : {paymentRef}</p>}
            </div>
          </div>
        )}

        {loading ? (
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <div className="aspect-[16/9] bg-muted/50 animate-pulse" />
            <div className="space-y-3 p-6">
              <div className="h-7 w-2/3 rounded-xl bg-muted/50 animate-pulse" />
              <div className="h-4 w-1/3 rounded-xl bg-muted/50 animate-pulse" />
            </div>
          </div>
        ) : !link || link.status === "blocked" ? (
          <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-card">
            <XCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h1 className="mt-4 font-heading text-xl font-bold">Lien indisponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ce lien de paiement n'existe plus ou n'est pas disponible.</p>
          </div>
        ) : link.status === "paused" ? (
          <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-card">
            <Clock3 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h1 className="mt-4 font-heading text-xl font-bold">Lien en pause</h1>
            <p className="mt-2 text-sm text-muted-foreground">{link.name} ne reçoit pas de paiements pour le moment. Repassez plus tard.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-hover">
            <div className="relative aspect-[16/9] bg-muted">
              {link.profile_image && <Image src={link.profile_image} alt={link.name} className="h-full w-full" fittingType="fill" />}
            </div>
            <div className="p-5 sm:p-6">
              <h1 className="font-heading text-2xl font-bold">{link.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{link.creator_name || "Membre NOVATRAX"}</p>
              {link.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{link.description}</p>
              )}

              {link.price_type === "fixed" ? (
                <p className="mt-4 font-heading text-3xl font-bold text-primary">{formatFcfa(link.price_fcfa)}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Montant libre — entre {formatFcfa(link.min_fcfa)} et {formatFcfa(link.max_fcfa)} :
                  </p>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-xl border border-border px-4 py-3 text-lg font-heading font-bold outline-none focus:border-primary bg-background"
                    placeholder={`Entre ${link.min_fcfa} et ${link.max_fcfa}`}
                  />
                </div>
              )}

              <input
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                maxLength={100}
                className="mt-3 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary bg-background"
                placeholder="Votre nom (facultatif — pour informer le bénéficiaire)"
              />

              {error && (
                <p className="mt-3 rounded-xl bg-destructive/5 border border-destructive/30 p-3 text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={pay}
                disabled={paying || !amountValid}
                className="mt-5 h-12 w-full rounded-xl gradient-novatrax text-base font-bold text-white shadow-card hover:shadow-card-hover"
              >
                {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                {paying ? "Ouverture du paiement sécurisé…" : payLabel}
              </Button>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Paiement en ligne sécurisé par NOVATRAX (Mobile Money). Le bénéficiaire reçoit directement le montant sur son portefeuille.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}