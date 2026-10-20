import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/client";
import { useMemberHome, useInvalidateMemberHome } from "@/hooks/useMemberHome";
import { formatFcfa } from "@/lib/commissions";
import { COUNTRIES, getWithdrawalMethods } from "@/lib/countries";
import FinanceBadge from "@/components/FinanceBadge";
import AccessFeeCard from "@/components/wallet/AccessFeeCard";
import WelcomeBonusCard from "@/components/wallet/WelcomeBonusCard";
import {
  Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, History, Loader2,
  CircleDollarSign, ExternalLink, X,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const MIN_DEPOSIT = 3000;
const MIN_WITHDRAWAL = 1500;

// Page portefeuille : dépôts via la page de paiement sécurisée LeekPay,
// retraits vérifiés côté serveur et historique temps réel des opérations.
export default function Wallet() {
  const { user } = useAuth();
  const { data: homeData, isLoading: homeLoading } = useMemberHome();
  const invalidateMemberHome = useInvalidateMemberHome();
  const balance = homeData?.stats?.balance ?? 0;
  const accessPending = homeData?.access?.pending ?? null;
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(["depot", "retrait", "historique"].includes(params.get("tab")) ? params.get("tab") : "depot");
  const [txs, setTxs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [returnRef, setReturnRef] = useState((params.get("tx") || "").trim());
  const [returnResult, setReturnResult] = useState((params.get("result") || "").trim());
  const [depositAmount, setDepositAmount] = useState("");
  const needsAccessFee = user?.role !== "admin" && user?.access_activated !== true;
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    country: user?.country || "",
    payment_method: "mobile_money",
    reception_number: "",
  });

  const load = useCallback(
    async (withLoading = true) => {
      if (withLoading) setLoading(true);
      try {
        const [txPage, wPage] = await Promise.all([
          api.entities.Transaction.filter({ user_id: user.id }, { sort: "-created_date", limit: 50 }),
          api.entities.Withdrawal.filter({ user_id: user.id }, { sort: "-created_date", limit: 50 }),
        ]);
        setTxs(txPage.items || []);
        setWithdrawals(wPage.items || []);
      } catch {
        // les listes seront rafraîchies au prochain événement temps réel
      } finally {
        if (withLoading) setLoading(false);
      }
    },
    [user.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Temps réel : le webhook LeekPay confirme le paiement côté serveur et le
  // statut se met à jour ici sans rechargement manuel de la page.
  useEffect(() => {
    const unsubscribe = api.entities.Transaction.subscribe(() => {
      load(false);
      invalidateMemberHome();
    });
    return unsubscribe;
  }, [load, invalidateMemberHome]);

  // Le moyen de réception est contraint aux méthodes réellement disponibles
  // dans le pays choisi : le choix est recentré automatiquement si besoin.
  useEffect(() => {
    const methods = getWithdrawalMethods(withdrawForm.country);
    if (methods.length > 0 && !methods.some((m) => m.value === withdrawForm.payment_method)) {
      setWithdrawForm((f) => ({ ...f, payment_method: methods[0].value }));
    }
  }, [withdrawForm.country, withdrawForm.payment_method]);

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amount = Number(depositAmount);
    if (!amount || amount < MIN_DEPOSIT) {
      toast({
        title: "Montant trop faible",
        description: `Le dépôt minimum est de ${MIN_DEPOSIT.toLocaleString("fr-FR")} FCFA.`,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.functions.invoke("leekpayCheckout", { amount_fcfa: amount });
      const url = res.data?.payment_url;
      if (!url) throw new Error("URL de paiement indisponible.");
      window.location.href = url;
    } catch (err) {
      toast({
        title: "Paiement impossible à lancer",
        description: err?.response?.data?.error || err?.message || "Réessayez dans un instant.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  // Frais d'accès (dépôt initial unique de 3 000 FCFA) via LeekPay :
  // montant fixé par le serveur, activation uniquement après confirmation serveur.
  const handleAccessFeePay = async () => {
    setSubmitting(true);
    try {
      const res = await api.functions.invoke("leekpayCheckout", { purpose: "access_fee" });
      const url = res.data?.payment_url;
      if (!url) throw new Error("URL de paiement indisponible.");
      window.location.href = url;
    } catch (err) {
      toast({
        title: "Paiement impossible à lancer",
        description: err?.response?.data?.error || err?.message || "Réessayez dans un instant.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const submitWithdrawal = async (e) => {
    e.preventDefault();
    const amount = Number(withdrawForm.amount);
    if (!amount || amount < MIN_WITHDRAWAL) {
      toast({
        title: "Montant trop faible",
        description: `Le retrait minimum est de ${MIN_WITHDRAWAL.toLocaleString("fr-FR")} FCFA.`,
        variant: "destructive",
      });
      return;
    }
    if (!withdrawForm.country) {
      toast({ title: "Pays requis", description: "Sélectionnez votre pays pour voir les moyens de réception disponibles.", variant: "destructive" });
      return;
    }
    const methods = getWithdrawalMethods(withdrawForm.country);
    if (!methods.some((m) => m.value === withdrawForm.payment_method)) {
      toast({ title: "Moyen de réception invalide", description: "Choisissez un moyen disponible dans votre pays.", variant: "destructive" });
      return;
    }
    if (!withdrawForm.reception_number.trim()) {
      toast({ title: "Numéro requis", description: "Indiquez le numéro qui recevra le paiement.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.functions.invoke("walletRequest", {
        action: "withdrawal",
        amount_fcfa: amount,
        country: withdrawForm.country,
        payment_method: withdrawForm.payment_method,
        reception_number: withdrawForm.reception_number.trim(),
      });
      toast({
        title: "Demande de retrait enregistrée",
        description: `Elle sera traitée par l'administration avant paiement. Solde disponible : ${formatFcfa(res.data?.balance ?? 0)}.`,
      });
      setWithdrawForm({ amount: "", country: withdrawForm.country, payment_method: withdrawForm.payment_method, reception_number: "" });
      load(false);
      invalidateMemberHome();
    } catch (err) {
      toast({
        title: "Retrait impossible",
        description: err?.response?.data?.error || err?.message || "Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const returnTx = returnRef ? txs.find((t) => t.reference === returnRef) : null;
  const tabs = [
    { id: "depot", label: "Dépôt", icon: ArrowDownToLine },
    { id: "retrait", label: "Retrait", icon: ArrowUpFromLine },
    { id: "historique", label: "Historique", icon: History },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl gradient-novatrax text-white">
          <WalletIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-bold">Mon portefeuille</h1>
          <p className="text-sm text-muted-foreground">Dépôts, retraits et historique de vos opérations.</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Solde disponible</p>
        <p className="mt-1 text-3xl font-heading font-bold text-emerald-600">
          {loading || homeLoading ? "…" : formatFcfa(balance)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Un dépôt n'est crédité qu'après confirmation réelle du paiement par LeekPay, côté serveur.
        </p>
      </div>

      <WelcomeBonusCard bonus={homeData?.welcome_bonus} />

      {returnRef && (
        <ReturnBanner reference={returnRef} result={returnResult} tx={returnTx} onDismiss={() => setReturnRef("")} />
      )}

      <div className="mt-6 flex gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-card">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id ? "gradient-novatrax text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === "depot" && (needsAccessFee ? (
          <AccessFeeCard pending={accessPending} submitting={submitting} onSubmit={handleAccessFeePay} />
        ) : (
          <form onSubmit={handleDeposit} className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <div>
              <label className="text-sm font-medium">Montant du dépôt (FCFA)</label>
              <input
                type="number"
                min={MIN_DEPOSIT}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
                placeholder={`Minimum ${MIN_DEPOSIT.toLocaleString("fr-FR")} FCFA`}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Vous serez redirigé vers la page de paiement sécurisée LeekPay pour choisir un moyen de paiement
              disponible pour votre pays (Mobile Money, carte, etc.). Aucun moyen de paiement n'est imposé ici :
              seuls ceux réellement proposés par LeekPay vous seront présentés.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-violet-foreground hover:bg-violet/90 disabled:opacity-50"
            >
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Connexion à LeekPay…</> : <><ExternalLink className="h-4 w-4" /> Payer avec LeekPay</>}
            </button>
          </form>
        ))}

        {tab === "retrait" && (
          <form onSubmit={submitWithdrawal} className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
            <div>
              <label className="text-sm font-medium">Montant du retrait (FCFA)</label>
              <input
                type="number"
                min={MIN_WITHDRAWAL}
                value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
                placeholder={`Minimum ${MIN_WITHDRAWAL.toLocaleString("fr-FR")} FCFA`}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Pays de réception</label>
              <select
                value={withdrawForm.country}
                onChange={(e) => {
                  const code = e.target.value;
                  const first = getWithdrawalMethods(code)[0]?.value || "";
                  setWithdrawForm((f) => ({ ...f, country: code, payment_method: first }));
                }}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Sélectionnez votre pays</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Moyen de réception</label>
              <select
                value={withdrawForm.payment_method}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, payment_method: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none"
              >
                {getWithdrawalMethods(withdrawForm.country).map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {withdrawForm.country
                  ? "Seuls les moyens disponibles dans votre pays sont proposés."
                  : "Sélectionnez d'abord votre pays pour voir les moyens disponibles."}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">
                {withdrawForm.payment_method === "bank_transfer"
                  ? "Compte bancaire qui recevra le paiement"
                  : "Numéro qui recevra le paiement"}
              </label>
              <input
                type="text"
                value={withdrawForm.reception_number}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, reception_number: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
                placeholder={withdrawForm.payment_method === "bank_transfer" ? "Numéro de compte / IBAN" : "Numéro de réception"}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">E-mail du compte</label>
              <input
                type="text"
                readOnly
                value={user?.email || ""}
                className="mt-1.5 w-full rounded-xl border border-input bg-muted/60 px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Le retrait minimum est de {MIN_WITHDRAWAL.toLocaleString("fr-FR")} FCFA et votre solde est vérifié côté serveur.
              Le montant demandé est réservé jusqu'à la décision finale ; en cas de refus, il est libéré.
              Aucun paiement n'est effectué avant l'approbation réelle de l'administration.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-violet-foreground hover:bg-violet/90 disabled:opacity-50"
            >
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</> : "Confirmer ma demande de retrait"}
            </button>
          </form>
        )}

        {tab === "historique" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <CircleDollarSign className="h-4 w-4 text-primary" /> Transactions
              </h2>
              {loading ? (
                <div className="mt-3 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-muted/50 animate-pulse" />)}</div>
              ) : txs.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                  Aucune transaction enregistrée pour le moment.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {txs.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {t.type === "deposit" ? "Dépôt" : t.type === "withdrawal" ? "Retrait" : "Ajustement"} · {formatFcfa(t.amount_fcfa)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.created_date ? new Date(t.created_date).toLocaleString("fr-FR") : "—"}
                          {t.reference ? ` · Réf. ${t.reference}` : ""}
                          {t.description ? ` · ${t.description}` : ""}
                        </p>
                      </div>
                      <FinanceBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <ArrowUpFromLine className="h-4 w-4 text-rose-500" /> Demandes de retrait
              </h2>
              {loading ? (
                <div className="mt-3 space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-muted/50 animate-pulse" />)}</div>
              ) : withdrawals.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                  Aucune demande de retrait pour le moment.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {withdrawals.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{formatFcfa(w.amount_fcfa)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {w.created_date ? new Date(w.created_date).toLocaleString("fr-FR") : "—"}
                          {w.transaction_ref ? ` · Réf. ${w.transaction_ref.slice(0, 8).toUpperCase()}` : ""}
                          {w.rejection_reason ? ` · Motif : ${w.rejection_reason}` : ""}
                        </p>
                      </div>
                      <FinanceBadge status={w.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnBanner({ reference, result, tx, onDismiss }) {
  let tone = "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";
  let title = "Paiement en cours de vérification";
  let text = "Votre paiement est enregistré. Dès que LeekPay le confirme côté serveur, votre solde sera crédité automatiquement — cette page se met à jour seule.";
  if (result === "annule") {
    title = "Paiement annulé";
    text = "Vous avez abandonné le paiement. Aucun montant n'a été débité et votre solde n'a pas changé.";
  } else if (tx?.status === "confirmed") {
    tone = "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400";
    title = "Dépôt confirmé";
    text = "Votre paiement a été vérifié par LeekPay et votre solde a été crédité.";
  } else if (tx?.status === "rejected") {
    tone = "border-destructive/30 bg-destructive/5 text-destructive";
    title = "Dépôt non abouti";
    text = "Le paiement a échoué, a été annulé ou a expiré. Aucun montant n'a été crédité.";
  }
  return (
    <div className={`relative mt-4 rounded-2xl border p-4 pr-10 ${tone}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
      <p className="mt-1 text-xs text-muted-foreground/80">Référence : {reference}</p>
      <button onClick={onDismiss} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" aria-label="Fermer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}