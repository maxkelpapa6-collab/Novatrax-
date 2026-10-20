import { formatFcfa } from "./helpers";

// Commissions par niveau sur les ventes Marketplace (N1 = 3 %, N2 = 1,5 %,
// N3 = 0,5 % du prix de vente, aucune commission au-delà du niveau 3). Toutes les valeurs sont lues côté
// serveur dans les enregistrements réels de commissions.
export default function CommissionsInfo({ commissions }) {
  const rates = { 1: "3 %", 2: "1,5 %", 3: "0,5 %" };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-heading text-base font-bold">Commissions</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((n) => {
          const l = commissions.by_level[n] || { count: 0, earned: 0 };
          const blocked = commissions.blocked.by_level[n] || { count: 0, total: 0 };
          return (
            <div key={n} className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Niveau {n} — {rates[n]} des ventes
              </p>
              <p className="mt-2 font-heading text-xl font-bold text-primary">{formatFcfa(l.earned)}</p>
              <p className="text-xs text-muted-foreground">{l.count} commission{l.count > 1 ? "s" : ""} gagnée{l.count > 1 ? "s" : ""}</p>
              {blocked.count > 0 && (
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {blocked.count} bloquée{blocked.count > 1 ? "s" : ""} ({formatFcfa(blocked.total)})
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="font-heading text-lg font-bold">{formatFcfa(commissions.earned_total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Total gagné</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="font-heading text-lg font-bold">{formatFcfa(commissions.available_estimate)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Commissions disponibles</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="font-heading text-lg font-bold">{formatFcfa(commissions.withdrawn_estimate)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Commissions déjà retirées</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className={`font-heading text-lg font-bold ${commissions.blocked.count > 0 ? "text-destructive" : ""}`}>
            {formatFcfa(commissions.blocked.total)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bloquées ({commissions.blocked.count})
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Les retraits puisent dans le solde global du portefeuille : la part déjà retirée est estimée à partir des
        retraits réellement payés. Aucune commission au-delà du niveau 3.
      </p>
    </div>
  );
}