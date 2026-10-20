import { ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { formatFcfa } from "@/lib/commissions";

// Frais d'accès NOVATRAX : dépôt initial unique de 3 000 FCFA via LeekPay.
// Le montant est imposé par le serveur (jamais choisi côté navigateur) et
// l'accès n'est activé qu'après la confirmation réelle du paiement par LeekPay.
export default function AccessFeeCard({ pending, submitting, onSubmit }) {
  return (
    <div className="rounded-2xl border border-violet/30 bg-accent/40 p-6 shadow-card space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet/15 text-violet">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-bold">Frais d'accès NOVATRAX</h2>
          <p className="text-xs text-muted-foreground">Dépôt initial unique obligatoire pour activer votre espace.</p>
        </div>
      </div>

      <div className="flex items-baseline justify-between rounded-xl border border-border bg-background px-4 py-3">
        <span className="text-sm font-medium">Montant unique (serveur)</span>
        <span className="font-heading text-2xl font-bold text-violet">{formatFcfa(3000)}</span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Ce dépôt unique débloque les formations, les applications Pro, l'annuaire de contacts et votre lien de
        parrainage. Vous serez redirigé vers la page de paiement sécurisée LeekPay : l'activation de votre accès est
        effective uniquement après la confirmation réelle du paiement par LeekPay, côté serveur — jamais au simple
        retour sur cette page.
      </p>

      {pending && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Un dépôt d'accès de {formatFcfa(3000)} est en attente de confirmation (réf. {pending.reference || "—"}).
          Dès que LeekPay confirme le paiement côté serveur, votre accès est activé automatiquement.
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-sm font-semibold text-violet-foreground hover:bg-violet/90 disabled:opacity-50"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Connexion à LeekPay…</>
        ) : (
          <><ExternalLink className="h-4 w-4" /> Payer mes frais d'accès ({formatFcfa(3000)})</>
        )}
      </button>
    </div>
  );
}