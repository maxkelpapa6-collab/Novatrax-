const STATUS_LABELS = {
  pending: "En attente",
  processing: "En traitement",
  approved: "Approuvé",
  paid: "Payé",
  confirmed: "Confirmé",
  rejected: "Rejeté",
  failed: "Échoué",
};

export { STATUS_LABELS };

export default function FinanceBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  const tone =
    status === "confirmed" || status === "paid"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "pending" || status === "processing" || status === "approved"
        ? "bg-amber-500/10 text-amber-600"
        : "bg-destructive/10 text-destructive";
  return (
    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}