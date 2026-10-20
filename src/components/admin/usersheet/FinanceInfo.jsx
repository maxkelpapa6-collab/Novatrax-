import { WITHDRAWAL_METHOD_LABELS } from "@/lib/countries";
import { formatFcfa, formatDateTime, withdrawalStatusLabel, statusTone } from "./helpers";

// Informations financières : tous les montants proviennent du calcul serveur
// sur les enregistrements réels (aucune valeur saisie manuellement).
export default function FinanceInfo({ finance, withdrawals }) {
  const cards = [
    { label: "Solde disponible", value: formatFcfa(finance.balance), highlight: true },
    { label: "Dépôts confirmés", value: formatFcfa(finance.deposits_total) },
    { label: "Frais d'accès payés", value: formatFcfa(finance.access_fees_total) },
    { label: "Commissions gagnées", value: formatFcfa(finance.commissions_confirmed) },
    { label: "Retraits payés", value: formatFcfa(finance.withdrawals_paid) },
    { label: "Retraits en cours", value: formatFcfa(finance.withdrawals_reserved) },
    { label: "Nombre de transactions", value: finance.transactions_count },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-heading text-base font-bold">Informations financières</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl p-4 ${c.highlight ? "gradient-novatrax text-white" : "bg-muted/50"}`}
          >
            <p className={`text-lg font-heading font-bold ${c.highlight ? "" : "text-primary"}`}>{c.value}</p>
            <p className={`mt-1 text-xs ${c.highlight ? "text-white/80" : "text-muted-foreground"}`}>{c.label}</p>
          </div>
        ))}
      </div>

      <h4 className="mt-5 text-sm font-bold">Derniers retraits</h4>
      {withdrawals.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucun retrait enregistré pour ce compte.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-3 py-2.5">Montant</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Moyen</th>
                <th className="px-3 py-2.5">Numéro</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5">Référence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withdrawals.map((w) => (
                <tr key={w.id}>
                  <td className="px-3 py-2.5 font-semibold">{formatFcfa(w.amount_fcfa)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(w.date)}</td>
                  <td className="px-3 py-2.5">{WITHDRAWAL_METHOD_LABELS[w.payment_method] || w.payment_method || "—"}</td>
                  <td className="px-3 py-2.5">{w.reception_number || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(w.status)}`}>
                      {withdrawalStatusLabel(w.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{w.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}