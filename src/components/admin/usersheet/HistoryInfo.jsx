import { HISTORY_KIND_LABELS, formatFcfa, formatDateTime, txStatusLabel, statusTone } from "./helpers";

// Historique du compte : fusion réelle des dépôts, retraits, commissions
// (N1/N2/N3) et ajustements administratifs — jamais supprimé automatiquement.
export default function HistoryInfo({ history }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-heading text-base font-bold">Historique du compte</h3>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucune opération enregistrée pour ce compte.</p>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {history.map((h, i) => (
            <div key={i} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-3">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary sm:w-44 text-center">
                {HISTORY_KIND_LABELS[h.kind] || h.kind}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{formatFcfa(h.amount_fcfa)}</p>
                {h.description && <p className="text-xs text-muted-foreground truncate">{h.description}</p>}
                {h.reference && <p className="text-xs text-muted-foreground/70">Réf. : {h.reference}</p>}
              </div>
              <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(h.status)}`}>
                  {txStatusLabel(h.status)}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(h.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}