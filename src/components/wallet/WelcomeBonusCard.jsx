import { Gift, Lock, CheckCircle2 } from "lucide-react";
import { formatFcfa } from "@/lib/commissions";

// Bonus de bienvenue (500 FCFA) : offert dès l'inscription, réservé jusqu'à
// l'activation de l'accès du membre — débloqué et crédité automatiquement
// côté serveur.
export default function WelcomeBonusCard({ bonus }) {
  const status = bonus?.status || "pending";
  const amount = bonus?.amount_fcfa ?? 500;
  const unlocked = status === "confirmed";

  return (
    <div className="mt-4 rounded-2xl border border-violet/30 bg-accent/50 p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet/15 text-violet">
          <Gift className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-bold">Bonus de bienvenue : {formatFcfa(amount)}</h2>
            {unlocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Débloqué
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                <Lock className="h-3 w-3" /> Réservé
              </span>
            )}
          </div>
          {unlocked ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Votre accès est activé : vos {formatFcfa(amount)} ont été crédités à votre portefeuille et sont retirables
              selon le solde disponible (retrait minimum 1 500 FCFA).
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Un bonus de {formatFcfa(amount)} est réservé pour vous dès votre inscription. Il est crédité automatiquement à
              votre portefeuille dès l'activation de votre accès.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}