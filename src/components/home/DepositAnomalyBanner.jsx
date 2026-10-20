import { ShieldAlert, Mail } from "lucide-react";

const SUPPORT_EMAIL = "novatraxagencies@gmail.com";

// Bandeau de double paiement : les frais d'accès ont été payés deux fois,
// dossier de remboursement en attente d'examen administratif.
export default function DepositAnomalyBanner() {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold text-amber-700 dark:text-amber-400">
            Double paiement détecté
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
            Nous avons reçu deux paiements de frais d'accès sur votre compte. Votre accès est bien activé. Si vous
            avez payé deux fois par erreur, contactez le support NOVATRAX par e-mail pour obtenir le remboursement.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Réclamation NOVATRAX — anomalie de dépôt")}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            <Mail className="h-4 w-4" /> CONTACTER LE SUPPORT
          </a>
        </div>
      </div>
    </div>
  );
}